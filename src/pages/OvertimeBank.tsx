import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Clock, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronDown,
  Search, Info, ArrowLeftRight, Wallet, CheckCircle2, XCircle, CalendarCheck,
  PiggyBank, Hourglass, Sparkles, User as UserIcon, ArrowRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { pt } from "date-fns/locale";
import {
  calculateWorkday, formatPunchTime, isPartTimeSchedule, minutesToHHMM,
  scheduledWorkMinutes, resolveTolerances, type Tolerances,
} from "@/lib/timeClock";
import { useHolidays } from "@/hooks/useHolidays";
import { computeBalance, type MovementLike } from "@/lib/timeBank";
import { OvertimeApprovalsTab } from "@/components/timeclock/OvertimeApprovalsTab";
import { UseBankHoursDialog } from "@/components/timeclock/UseBankHoursDialog";
import { MonthlyClosureTab } from "@/components/timeclock/MonthlyClosureTab";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";

type DayRow = {
  date: string;
  dayName: string;
  scheduled: number;
  worked: number;
  diff: number;
  isDayOff: boolean;
  incomplete?: boolean;
  isBankDeduction?: boolean;
  isVacation?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  punchedOnDayOff?: boolean;
  clockIn?: string | null;
  clockOut?: string | null;
  lunchOut?: string | null;
  lunchIn?: string | null;
  schedClockIn?: string;
  schedClockOut?: string;
  schedLunchOut?: string;
  schedLunchIn?: string;
};

type ScheduleRow = {
  day_of_week: number;
  clock_in_time: string;
  lunch_out_time: string;
  lunch_in_time: string;
  clock_out_time: string;
  is_day_off: boolean;
};

type EmployeeSummary = {
  id: string;
  first_name: string;
  last_name: string;
  position?: string | null;
  avatar_url?: string | null;
  schedule_template_id?: string | null;
  balance: number;
  accumulated: number;
};

export default function OvertimeBank() {
  const currentDate = new Date();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [month, setMonth] = useState(currentDate.getMonth());
  const [year, setYear] = useState(currentDate.getFullYear());
  const [employeeQuery, setEmployeeQuery] = useState("");
  const { isHoliday, getHoliday } = useHolidays();
  const { data: isAdmin } = useIsAdmin();
  const [useBankOpen, setUseBankOpen] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["employees-active-overtime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, avatar_url, schedule_template_id")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const rangeStart = format(startOfMonth(new Date(year, month)), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(new Date(year, month)), "yyyy-MM-dd");

  const prevMonthDate = new Date(year, month - 1, 1);
  const prevRangeStart = format(startOfMonth(prevMonthDate), "yyyy-MM-dd");
  const prevRangeEnd = format(endOfMonth(prevMonthDate), "yyyy-MM-dd");

  const { data: records } = useQuery({
    queryKey: ["overtime-records", selectedEmployee, rangeStart, rangeEnd],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .gte("record_date", rangeStart)
        .lte("record_date", rangeEnd)
        .order("record_date");
      if (error) throw error;
      return data;
    },
  });

  const emp = employees?.find((e) => e.id === selectedEmployee);

  const { data: templateDays } = useQuery({
    queryKey: ["template-days-overtime", emp?.schedule_template_id],
    enabled: !!emp?.schedule_template_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template_days")
        .select("*")
        .eq("template_id", emp!.schedule_template_id!);
      if (error) throw error;
      return data;
    },
  });

  const { data: employeeScheduleRows } = useQuery({
    queryKey: ["employee-schedules-overtime", selectedEmployee],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_schedules")
        .select("*")
        .eq("employee_id", selectedEmployee);
      if (error) throw error;
      return data as Array<{
        day_of_week: number;
        clock_in_time: string;
        lunch_out_time: string;
        lunch_in_time: string;
        clock_out_time: string;
        is_day_off: boolean;
      }>;
    },
  });

  const { data: selectedTemplate } = useQuery({
    queryKey: ["template-tolerance", emp?.schedule_template_id],
    enabled: !!emp?.schedule_template_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes")
        .eq("id", emp!.schedule_template_id!)
        .single();
      if (error) throw error;
      return data as Tolerances;
    },
  });

  const { data: bankAbsences } = useQuery({
    queryKey: ["bank-absences", selectedEmployee, rangeStart, rangeEnd],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .eq("deducted_from_bank", true)
        .gte("absence_date", rangeStart)
        .lte("absence_date", rangeEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: vacations } = useQuery({
    queryKey: ["vacations-overtime", selectedEmployee, rangeStart, rangeEnd],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("start_date, end_date, status")
        .eq("employee_id", selectedEmployee)
        .in("status", ["approved", "confirmed"])
        .lte("start_date", rangeEnd)
        .gte("end_date", rangeStart);
      if (error) throw error;
      return data as { start_date: string; end_date: string }[];
    },
  });

  const { data: empBankMovements } = useQuery({
    queryKey: ["overtime-emp-bank-movements", selectedEmployee, rangeStart, rangeEnd],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_movements")
        .select("effective_minutes, status, record_date")
        .eq("employee_id", selectedEmployee)
        .eq("status", "approved")
        .gte("record_date", rangeStart)
        .lte("record_date", rangeEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  // All approved/paid movements globally — used to compute the official accumulated balance
  const { data: allApprovedMovements } = useQuery({
    queryKey: ["overtime-all-approved-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_movements")
        .select("employee_id, effective_minutes, status, record_date")
        .in("status", ["approved", "paid"]);
      if (error) throw error;
      return data as any[];
    },
  });

  // All monthly closures — used to anchor accumulated to last carried_over balance
  const { data: allClosures } = useQuery({
    queryKey: ["overtime-all-closures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_monthly_closures")
        .select("employee_id, period_year, period_month, carried_over_minutes");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allMonthRecords } = useQuery({
    queryKey: ["overtime-all-month-records", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("employee_id, record_date, clock_in, lunch_out, lunch_in, clock_out")
        .gte("record_date", rangeStart)
        .lte("record_date", rangeEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allEmployeeSchedules } = useQuery({
    queryKey: ["overtime-all-employee-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_schedules")
        .select("employee_id, day_of_week, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off");
      if (error) throw error;
      return data as Array<ScheduleRow & { employee_id: string }>;
    },
  });

  const { data: allTemplateDays } = useQuery({
    queryKey: ["overtime-all-template-days"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template_days")
        .select("template_id, day_of_week, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off");
      if (error) throw error;
      return data as Array<ScheduleRow & { template_id: string }>;
    },
  });

  const { data: allTemplateTolerances } = useQuery({
    queryKey: ["overtime-all-template-tolerances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("id, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes");
      if (error) throw error;
      return data as Array<Tolerances & { id: string }>;
    },
  });

  // Accumulated balance per employee as of the end of the viewed month, following the
  // official rule: last closure carried_over + approved/paid movements after that cutoff.
  const accumulatedByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    const closures = allClosures || [];
    const movs = allApprovedMovements || [];
    const movsByEmp = new Map<string, any[]>();
    for (const m of movs) {
      if (!m.record_date || m.record_date > rangeEnd) continue;
      const arr = movsByEmp.get(m.employee_id) || [];
      arr.push(m);
      movsByEmp.set(m.employee_id, arr);
    }
    const closuresByEmp = new Map<string, any[]>();
    for (const c of closures) {
      // Only consider closures up to the viewed month (period_month is 1-12)
      if (c.period_year > year) continue;
      if (c.period_year === year && c.period_month - 1 > month) continue;
      const arr = closuresByEmp.get(c.employee_id) || [];
      arr.push(c);
      closuresByEmp.set(c.employee_id, arr);
    }
    const empIds = new Set<string>([
      ...Array.from(movsByEmp.keys()),
      ...Array.from(closuresByEmp.keys()),
    ]);
    for (const empId of empIds) {
      const empClosures = (closuresByEmp.get(empId) || []).sort(
        (a, b) => (b.period_year - a.period_year) || (b.period_month - a.period_month)
      );
      const last = empClosures[0];
      const empMovs = movsByEmp.get(empId) || [];
      if (!last) {
        map.set(
          empId,
          empMovs.reduce((s, m) => s + (Number(m.effective_minutes) || 0), 0)
        );
        continue;
      }
      const cutoff = format(
        endOfMonth(new Date(last.period_year, last.period_month - 1)),
        "yyyy-MM-dd"
      );
      const after = empMovs
        .filter((m) => m.record_date > cutoff)
        .reduce((s, m) => s + (Number(m.effective_minutes) || 0), 0);
      map.set(empId, Number(last.carried_over_minutes || 0) + after);
    }
    return map;
  }, [allApprovedMovements, allClosures, year, month, rangeEnd]);

  const rows = useMemo(() => {
    if (!records) return [];
    const hasIndividual = (employeeScheduleRows?.length || 0) > 0;
    if (!hasIndividual && !templateDays) return [];

    const tolerances = resolveTolerances(selectedTemplate);
    const scheduleMap = new Map<number, any>();
    (templateDays || []).forEach((d) => scheduleMap.set(d.day_of_week, d as any));
    (employeeScheduleRows || []).forEach((d) => scheduleMap.set(d.day_of_week, d));

    const recordMap = new Map<string, (typeof records)[0]>();
    records.forEach((r) => recordMap.set(r.record_date, r));

    const bankAbsenceSet = new Set<string>();
    bankAbsences?.forEach((a) => bankAbsenceSet.add(a.absence_date));

    const isVacationDate = (dateStr: string): boolean =>
      (vacations || []).some((v) => dateStr >= v.start_date && dateStr <= v.end_date);

    const days = eachDayOfInterval({
      start: new Date(year, month, 1),
      end: endOfMonth(new Date(year, month, 1)),
    });

    const today = format(new Date(), "yyyy-MM-dd");
    const result: DayRow[] = [];

    for (const d of days) {
      const dateStr = format(d, "yyyy-MM-dd");
      if (dateStr > today) continue;

      const dow = d.getDay();
      const schedule = scheduleMap.get(dow);
      const record = recordMap.get(dateStr);
      const isBankDeduction = bankAbsenceSet.has(dateStr);
      const onVacation = isVacationDate(dateStr);
      const holiday = getHoliday(dateStr);

      if (onVacation) {
        result.push({ date: dateStr, dayName: format(d, "EEEE", { locale: pt }), scheduled: 0, worked: 0, diff: 0, isDayOff: false, isVacation: true });
        continue;
      }
      if (holiday) {
        result.push({ date: dateStr, dayName: format(d, "EEEE", { locale: pt }), scheduled: 0, worked: 0, diff: 0, isDayOff: false, isHoliday: true, holidayName: holiday.name });
        continue;
      }
      if (isBankDeduction && schedule && !schedule.is_day_off) {
        const scheduledWork = scheduledWorkMinutes(schedule);
        result.push({
          date: dateStr, dayName: format(d, "EEEE", { locale: pt }),
          scheduled: scheduledWork, worked: 0, diff: -scheduledWork,
          isDayOff: false, isBankDeduction: true,
          schedClockIn: schedule.clock_in_time, schedClockOut: schedule.clock_out_time,
          schedLunchOut: schedule.lunch_out_time, schedLunchIn: schedule.lunch_in_time,
        });
        continue;
      }
      if (!schedule || schedule.is_day_off) {
        if (record && (record.clock_in || record.lunch_out || record.lunch_in || record.clock_out)) {
          result.push({
            date: dateStr, dayName: format(d, "EEEE", { locale: pt }),
            scheduled: 0, worked: 0, diff: 0, isDayOff: true, punchedOnDayOff: true,
            clockIn: record.clock_in, clockOut: record.clock_out,
            lunchOut: record.lunch_out, lunchIn: record.lunch_in,
          });
        }
        continue;
      }

      const partTime = isPartTimeSchedule(schedule);
      const calculated = calculateWorkday(record, schedule, tolerances);
      const normalized = calculated.normalized;
      const effectiveClockOut = partTime ? (normalized.lunch_out || normalized.clock_out) : normalized.clock_out;

      result.push({
        date: dateStr, dayName: format(d, "EEEE", { locale: pt }),
        scheduled: calculated.scheduled, worked: calculated.worked, diff: calculated.diff,
        isDayOff: false, incomplete: calculated.incomplete,
        clockIn: normalized.clock_in ?? null, clockOut: effectiveClockOut ?? null,
        lunchOut: partTime ? null : (normalized.lunch_out ?? null),
        lunchIn: partTime ? null : (normalized.lunch_in ?? null),
        schedClockIn: schedule.clock_in_time,
        schedClockOut: partTime ? schedule.lunch_out_time : schedule.clock_out_time,
        schedLunchOut: partTime ? undefined : schedule.lunch_out_time,
        schedLunchIn: partTime ? undefined : schedule.lunch_in_time,
      });
    }
    return result;
  }, [records, templateDays, employeeScheduleRows, bankAbsences, vacations, selectedTemplate, month, year, getHoliday]);

  const totalBalance = rows.reduce((sum, r) => sum + r.diff, 0);
  const totalOvertime = rows.reduce((sum, r) => sum + Math.max(0, r.diff), 0);
  const totalDeficit = rows.reduce((sum, r) => sum + Math.min(0, r.diff), 0);

  const officialMonthBalance = useMemo(
    () => (empBankMovements ?? []).reduce((s, m) => s + (Number(m.effective_minutes) || 0), 0),
    [empBankMovements]
  );
  const isCurrentMonth = month === currentDate.getMonth() && year === currentDate.getFullYear();
  const accumulatedBalance = useMemo(
    () => (selectedEmployee ? accumulatedByEmployee.get(selectedEmployee) ?? 0 : 0),
    [selectedEmployee, accumulatedByEmployee]
  );

  // ---- Summary per employee (official rule for month + accumulated) ----
  const summaryPerEmployee = useMemo<EmployeeSummary[]>(() => {
    if (!employees) return [];
    const monthByEmp = new Map<string, number>();
    const monthMovementEmpIds = new Set<string>();
    for (const m of allApprovedMovements || []) {
      if (!m.record_date) continue;
      if (m.record_date < rangeStart || m.record_date > rangeEnd) continue;
      monthMovementEmpIds.add(m.employee_id);
      monthByEmp.set(
        m.employee_id,
        (monthByEmp.get(m.employee_id) || 0) + (Number(m.effective_minutes) || 0)
      );
    }
    const recordsByEmp = new Map<string, any[]>();
    for (const record of allMonthRecords || []) {
      const arr = recordsByEmp.get(record.employee_id) || [];
      arr.push(record);
      recordsByEmp.set(record.employee_id, arr);
    }
    const individualSchedulesByEmp = new Map<string, Map<number, ScheduleRow>>();
    for (const schedule of allEmployeeSchedules || []) {
      const map = individualSchedulesByEmp.get(schedule.employee_id) || new Map<number, ScheduleRow>();
      map.set(schedule.day_of_week, schedule);
      individualSchedulesByEmp.set(schedule.employee_id, map);
    }
    const templateDaysByTemplate = new Map<string, Map<number, ScheduleRow>>();
    for (const schedule of allTemplateDays || []) {
      const map = templateDaysByTemplate.get(schedule.template_id) || new Map<number, ScheduleRow>();
      map.set(schedule.day_of_week, schedule);
      templateDaysByTemplate.set(schedule.template_id, map);
    }
    const tolerancesByTemplate = new Map<string, Tolerances>();
    for (const tolerance of allTemplateTolerances || []) {
      tolerancesByTemplate.set(tolerance.id, tolerance);
    }
    const attendanceMonthByEmp = new Map<string, number>();
    for (const emp of employees) {
      if (monthMovementEmpIds.has(emp.id)) continue;
      const empRecords = recordsByEmp.get(emp.id) || [];
      if (empRecords.length === 0) continue;
      const recordMap = new Map<string, any>();
      empRecords.forEach((record) => recordMap.set(record.record_date, record));
      const individual = individualSchedulesByEmp.get(emp.id);
      const template = emp.schedule_template_id ? templateDaysByTemplate.get(emp.schedule_template_id) : undefined;
      if (!individual && !template) continue;
      const tolerances = resolveTolerances(emp.schedule_template_id ? tolerancesByTemplate.get(emp.schedule_template_id) : null);
      let total = 0;
      eachDayOfInterval({ start: new Date(year, month, 1), end: endOfMonth(new Date(year, month, 1)) }).forEach((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        if (dateStr > format(new Date(), "yyyy-MM-dd")) return;
        // Skip the in-progress day so an unfinished punch doesn't inflate the live month deficit
        if (isCurrentMonth && dateStr === format(new Date(), "yyyy-MM-dd")) return;
        const schedule = individual?.get(date.getDay()) || template?.get(date.getDay());
        if (!schedule || schedule.is_day_off) return;
        const calculated = calculateWorkday(recordMap.get(dateStr), schedule, tolerances);
        total += calculated.diff;
      });
      attendanceMonthByEmp.set(emp.id, total);
    }
    return employees.map((emp) => ({
      ...emp,
      balance: monthByEmp.get(emp.id) || attendanceMonthByEmp.get(emp.id) || 0,
      accumulated: (accumulatedByEmployee.get(emp.id) || 0) + (
        isCurrentMonth && !monthMovementEmpIds.has(emp.id) ? (attendanceMonthByEmp.get(emp.id) || 0) : 0
      ),
    }));
  }, [employees, allApprovedMovements, allMonthRecords, allEmployeeSchedules, allTemplateDays, allTemplateTolerances, accumulatedByEmployee, rangeStart, rangeEnd, year, month, isCurrentMonth]);

  const selectedSummary = useMemo(
    () => summaryPerEmployee.find((employee) => employee.id === selectedEmployee),
    [summaryPerEmployee, selectedEmployee]
  );
  const displayedMonthBalance = selectedSummary?.balance ?? officialMonthBalance;
  const displayedAccumulatedBalance = selectedSummary?.accumulated ?? accumulatedBalance;

  // -------- Conta-Corrente --------
  const { data: bankMovements } = useQuery({
    queryKey: ["time-bank-movements", selectedEmployee || "all"],
    queryFn: async () => {
      let q = supabase.from("time_bank_movements").select("*").order("record_date", { ascending: false }).limit(200);
      if (selectedEmployee) q = q.eq("employee_id", selectedEmployee);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const bankBalance = useMemo(
    () => computeBalance((bankMovements ?? []) as MovementLike[]),
    [bankMovements]
  );

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return summaryPerEmployee;
    return summaryPerEmployee.filter((e) =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q)
    );
  }, [summaryPerEmployee, employeeQuery]);

  const navigateMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const periodLabel = format(new Date(year, month, 1), "MMMM yyyy", { locale: pt });

  return (
    <AppLayout>
      <div className="space-y-5 max-w-[1400px] mx-auto">
        {/* HERO */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <PiggyBank className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Banco de Horas</h1>
              <p className="text-xs text-muted-foreground">Saldo mensal, acumulado e conta corrente por colaborador</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border bg-card px-1 py-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] text-center text-sm font-semibold capitalize">{periodLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isCurrentMonth && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setMonth(currentDate.getMonth()); setYear(currentDate.getFullYear()); }}>
                Hoje
              </Button>
            )}
            {isAdmin && selectedEmployee && (
              <Button size="sm" className="h-9 gap-1.5" onClick={() => setUseBankOpen(true)}>
                <ArrowLeftRight className="h-4 w-4" />
                Usar horas
              </Button>
            )}
          </div>
        </div>

        {/* EMPLOYEE PICKER / SELECTED CARD */}
        {!selectedEmployee ? (
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Colaboradores</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Clique para abrir o detalhe do banco</p>
              </div>
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  placeholder="Procurar colaborador..."
                  className="h-9 pl-8 text-sm bg-muted/40 border-border/60"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold">Colaborador</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold">Saldo do Mês</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold">Saldo Acumulado</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees?.map((e) => (
                      <TableRow
                        key={e.id}
                        className="cursor-pointer transition-colors hover:bg-primary/5 border-border/40"
                        onClick={() => setSelectedEmployee(e.id)}
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              {e.first_name?.[0]}{e.last_name?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-tight">{e.first_name} {e.last_name}</p>
                              {e.position && <p className="text-[11px] text-muted-foreground">{e.position}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <BalancePill minutes={e.balance} />
                        </TableCell>
                        <TableCell className="text-right">
                          <BalancePill minutes={e.accumulated} bold />
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!filteredEmployees || filteredEmployees.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10 text-sm">
                          {employeeQuery ? "Nenhum colaborador encontrado" : "Sem dados disponíveis"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 shadow-sm bg-gradient-to-br from-card to-primary/[0.02]">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold ring-2 ring-primary/20">
                {emp?.first_name?.[0]}{emp?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-lg font-bold leading-tight">{emp?.first_name} {emp?.last_name}</h2>
                {emp?.position && <p className="text-xs text-muted-foreground">{emp.position}</p>}
              </div>
              {selectedTemplate && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
                      <Info className="h-3.5 w-3.5" /> Tolerâncias
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs space-y-1.5">
                    <p className="flex justify-between"><span className="text-muted-foreground">Atraso</span><strong>{selectedTemplate.tolerance_late_minutes} min</strong></p>
                    <p className="flex justify-between"><span className="text-muted-foreground">Hora extra</span><strong>{selectedTemplate.tolerance_overtime_minutes} min</strong></p>
                    <p className="flex justify-between"><span className="text-muted-foreground">Saída antecipada</span><strong>sem tolerância</strong></p>
                  </PopoverContent>
                </Popover>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedEmployee("")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar à lista
              </Button>
            </CardContent>
          </Card>
        )}

        {/* TABS */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="overview" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Visão Geral</span><span className="sm:hidden">Saldos</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Conta Corrente</span><span className="sm:hidden">Conta</span>
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Aprovações</span><span className="sm:hidden">Aprov.</span>
            </TabsTrigger>
            <TabsTrigger value="closure" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Fecho Mensal</span><span className="sm:hidden">Fecho</span>
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {selectedEmployee ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <BalanceHeroCard
                    icon={Clock}
                    label="Saldo do Mês"
                    minutes={displayedMonthBalance}
                    sub={
                      <div className="flex gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-primary"><TrendingUp className="h-3 w-3" />+{minutesToHHMM(totalOvertime).replace("-", "")}</span>
                        <span className="flex items-center gap-1 text-destructive"><TrendingDown className="h-3 w-3" />{minutesToHHMM(totalDeficit)}</span>
                      </div>
                    }
                  />
                  <BalanceHeroCard
                    icon={Hourglass}
                    label="Mês Anterior"
                    minutes={displayedAccumulatedBalance - displayedMonthBalance}
                    sub={<span className="text-[11px] text-muted-foreground">{format(prevMonthDate, "MMMM yyyy", { locale: pt })}</span>}
                  />
                  <BalanceHeroCard
                    icon={PiggyBank}
                    label={isCurrentMonth ? "Saldo Transitado" : "Saldo Acumulado"}
                    minutes={displayedAccumulatedBalance}
                    highlight
                    sub={
                      <span className={cn(
                        "text-[11px] font-semibold",
                        displayedAccumulatedBalance > 0 ? "text-primary" : displayedAccumulatedBalance < 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {displayedAccumulatedBalance > 0 ? "A favor do colaborador" : displayedAccumulatedBalance < 0 ? "A dever à empresa" : "Banco equilibrado"}
                      </span>
                    }
                  />
                </div>

                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Detalhe Diário
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/60">
                          <TableHead className="w-6"></TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Data</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Dia</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70">Previsto</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70">Realizado</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70">Diferença</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => {
                          const accumulated = rows.slice(0, i + 1).reduce((s, x) => s + x.diff, 0);
                          const isExpanded = expandedDate === r.date;
                          const accent = r.isHoliday ? "bg-info" : r.isVacation ? "bg-success" : r.punchedOnDayOff ? "bg-warning" : r.isBankDeduction ? "bg-destructive" : null;
                          return (
                            <>
                              <TableRow
                                key={r.date}
                                className={cn("cursor-pointer border-border/40 relative", isExpanded && "bg-muted/30")}
                                onClick={() => setExpandedDate(isExpanded ? null : r.date)}
                              >
                                <TableCell className="w-6 px-2 relative">
                                  {accent && <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r", accent)} />}
                                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/60 transition-transform", isExpanded && "rotate-180")} />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{format(new Date(r.date + "T12:00:00"), "dd/MM")}</TableCell>
                                <TableCell className="capitalize text-sm">
                                  <span className="text-foreground/90">{r.dayName}</span>
                                  {r.isDayOff && !r.punchedOnDayOff && <Badge variant="outline" className="ml-2 text-[10px] font-normal">Folga</Badge>}
                                  {r.isVacation && <Badge className="ml-2 text-[10px] bg-success/15 text-success border-success/30 font-normal" variant="outline">Férias</Badge>}
                                  {r.isHoliday && <Badge className="ml-2 text-[10px] bg-info/15 text-info border-info/30 font-normal" variant="outline">Feriado{r.holidayName ? ` · ${r.holidayName}` : ""}</Badge>}
                                  {r.punchedOnDayOff && <Badge className="ml-2 text-[10px] bg-warning/15 text-warning border-warning/30 font-normal" variant="outline">Picou em Folga</Badge>}
                                  {r.isBankDeduction && <Badge className="ml-2 text-[10px] bg-destructive/15 text-destructive border-destructive/30 font-normal" variant="outline">Falta (Banco)</Badge>}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  {formatHMNoSign(r.scheduled)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatHMNoSign(r.worked)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={cn(
                                    "font-mono text-sm font-semibold",
                                    r.diff > 0 ? "text-primary" : r.diff < 0 ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    {minutesToHHMM(r.diff)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={cn(
                                    "font-mono text-sm font-bold",
                                    accumulated > 0 ? "text-primary" : accumulated < 0 ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    {minutesToHHMM(accumulated)}
                                  </span>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow key={`${r.date}-detail`} className="bg-muted/30 hover:bg-muted/30 border-border/40">
                                  <TableCell colSpan={7} className="py-4 px-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <PunchDetail label="Entrada" actual={r.clockIn ?? null} scheduled={r.schedClockIn} />
                                      <PunchDetail label="Saída Almoço" actual={r.lunchOut ?? null} scheduled={r.schedLunchOut} />
                                      <PunchDetail label="Regresso" actual={r.lunchIn ?? null} scheduled={r.schedLunchIn} />
                                      <PunchDetail label="Saída" actual={r.clockOut ?? null} scheduled={r.schedClockOut} />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                              Sem registos para este período
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <EmptyState
                icon={UserIcon}
                title="Selecione um colaborador"
                description="Clique numa linha da lista acima para ver o detalhe diário, saldos e movimentos do banco de horas."
              />
            )}
          </TabsContent>

          {/* ACCOUNT */}
          <TabsContent value="account" className="space-y-4 mt-4">
            <Card className="border-primary/30 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Saldo Disponível</p>
                      <p className={cn(
                        "font-display font-bold text-4xl font-mono leading-tight tracking-tight",
                        bankBalance.available > 0 ? "text-primary" : bankBalance.available < 0 ? "text-destructive" : "text-foreground"
                      )}>
                        {minutesToHHMM(bankBalance.available)}
                      </p>
                      <p className={cn(
                        "text-xs font-medium mt-0.5",
                        bankBalance.available > 0 ? "text-primary" : bankBalance.available < 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {bankBalance.available > 0 ? "A favor do colaborador" : bankBalance.available < 0 ? "A dever à empresa" : "Banco equilibrado"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saldo Potencial</p>
                    <p className={cn(
                      "font-mono font-semibold text-lg",
                      bankBalance.potential >= 0 ? "text-foreground" : "text-destructive"
                    )}>
                      {minutesToHHMM(bankBalance.potential)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">inclui pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MiniStat icon={CheckCircle2} label="Aprovado" minutes={bankBalance.approved} tone="primary" />
              <MiniStat icon={Hourglass} label="Pendente" minutes={bankBalance.pending} tone="warning" />
              <MiniStat icon={ArrowRight} label="Usado" minutes={-bankBalance.used} tone="muted" />
              <MiniStat icon={Wallet} label="Pago" minutes={bankBalance.paid} tone="muted" />
              <MiniStat icon={XCircle} label="Rejeitado" minutes={bankBalance.rejected} tone="muted" />
            </div>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                  Movimentos {selectedEmployee && emp ? `· ${emp.first_name} ${emp.last_name}` : "· Todos"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Data</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Tipo</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Origem</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Descrição</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/70">Status</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground/70">Minutos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(bankMovements || []).map((m: any) => {
                      const isCredit = (m.effective_minutes ?? m.minutes) > 0;
                      const mins = m.effective_minutes ?? m.minutes;
                      return (
                        <TableRow key={m.id} className="border-border/40">
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {format(new Date(m.record_date + "T12:00:00"), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className={cn(
                              "font-normal text-[10px]",
                              isCredit ? "border-primary/30 text-primary bg-primary/5" : "border-destructive/30 text-destructive bg-destructive/5"
                            )}>
                              {m.movement_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">{m.source_type || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate" title={m.description || ""}>{m.description || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={m.status} decision={m.decision} />
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-sm font-semibold",
                            isCredit ? "text-primary" : "text-destructive"
                          )}>
                            {minutesToHHMM(mins)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!bankMovements || bankMovements.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                          Sem movimentos registados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="mt-4">
            <OvertimeApprovalsTab employeeId={selectedEmployee || undefined} />
          </TabsContent>

          {/* CLOSURE */}
          <TabsContent value="closure" className="mt-4">
            <MonthlyClosureTab employeeId={selectedEmployee || undefined} />
          </TabsContent>
        </Tabs>

        <UseBankHoursDialog
          open={useBankOpen}
          onOpenChange={setUseBankOpen}
          defaultEmployeeId={selectedEmployee || undefined}
        />
      </div>
    </AppLayout>
  );
}

// ===== Sub-components =====

function formatHMNoSign(minutes: number) {
  const abs = Math.abs(minutes);
  return `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function BalancePill({ minutes, bold }: { minutes: number; bold?: boolean }) {
  const positive = minutes > 0;
  const negative = minutes < 0;
  return (
    <span className={cn(
      "inline-flex items-center justify-center min-w-[78px] rounded-md px-2.5 py-1 font-mono text-xs",
      bold && "text-sm font-bold",
      positive && "bg-primary/10 text-primary",
      negative && "bg-destructive/10 text-destructive",
      !positive && !negative && "bg-muted text-muted-foreground"
    )}>
      {minutesToHHMM(minutes)}
    </span>
  );
}

function BalanceHeroCard({ icon: Icon, label, minutes, sub, highlight }: {
  icon: any; label: string; minutes: number; sub?: React.ReactNode; highlight?: boolean;
}) {
  const positive = minutes > 0;
  const negative = minutes < 0;
  return (
    <Card className={cn(
      "border-border/60 shadow-sm overflow-hidden relative",
      highlight && "border-primary/40 bg-gradient-to-br from-primary/5 to-transparent ring-1 ring-primary/10"
    )}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className={cn(
          "font-display font-bold text-2xl font-mono tracking-tight",
          positive ? "text-primary" : negative ? "text-destructive" : "text-foreground"
        )}>
          {minutesToHHMM(minutes)}
        </p>
        {sub && <div className="mt-1.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, minutes, tone }: {
  icon: any; label: string; minutes: number; tone: "primary" | "warning" | "muted";
}) {
  const toneClass = tone === "primary" ? "text-primary bg-primary/10" : tone === "warning" ? "text-warning bg-warning/10" : "text-muted-foreground bg-muted";
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="py-3 px-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", toneClass)}>
            <Icon className="h-3 w-3" />
          </div>
          <p className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        </div>
        <p className="font-mono font-bold text-base">{minutesToHHMM(minutes)}</p>
      </CardContent>
    </Card>
  );
}

function PunchDetail({ label, actual, scheduled }: { label: string; actual: string | null; scheduled?: string }) {
  const a = formatPunchTime(actual);
  const s = scheduled ? scheduled.slice(0, 5) : null;
  return (
    <div className="rounded-lg bg-card border border-border/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-semibold text-sm">{a}</span>
        {s && <span className="text-[10px] text-muted-foreground">prev. {s}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status, decision }: { status?: string; decision?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprovado", cls: "bg-primary/10 text-primary border-primary/30" },
    pending: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
    rejected: { label: "Rejeitado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    paid: { label: "Pago", cls: "bg-muted text-muted-foreground border-border" },
  };
  const key = (status || "").toLowerCase();
  const entry = map[key] ?? { label: status || "—", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("font-normal text-[10px]", entry.cls)}>
      {entry.label}{decision && decision !== status ? ` · ${decision}` : ""}
    </Badge>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <Card className="border-dashed border-border/60 shadow-none">
      <CardContent className="flex flex-col items-center justify-center py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
          <Icon className="h-5 w-5" />
        </div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}