import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, TrendingDown, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { pt } from "date-fns/locale";
import { calculateWorkday, formatPunchTime, isPartTimeSchedule, minutesToHHMM, scheduledWorkMinutes, type Tolerances } from "@/lib/timeClock";

type DayRow = {
  date: string;
  dayName: string;
  scheduled: number;
  worked: number;
  diff: number;
  isDayOff: boolean;
  incomplete?: boolean;
  isBankDeduction?: boolean;
  clockIn?: string | null;
  clockOut?: string | null;
  lunchOut?: string | null;
  lunchIn?: string | null;
  schedClockIn?: string;
  schedClockOut?: string;
  schedLunchOut?: string;
  schedLunchIn?: string;
};

export default function OvertimeBank() {
  const currentDate = new Date();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [month, setMonth] = useState(String(currentDate.getMonth()));
  const [year, setYear] = useState(String(currentDate.getFullYear()));

  const { data: employees } = useQuery({
    queryKey: ["employees-active-overtime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, schedule_template_id")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const selectedMonth = parseInt(month);
  const selectedYear = parseInt(year);
  const rangeStart = format(startOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");

  // Previous month range
  const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
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

  // Previous month records for selected employee
  const { data: prevRecords } = useQuery({
    queryKey: ["overtime-records-prev", selectedEmployee, prevRangeStart, prevRangeEnd],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .gte("record_date", prevRangeStart)
        .lte("record_date", prevRangeEnd)
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

  // Fetch schedule template tolerances for selected employee
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

  // Fetch bank-deducted absences for selected employee (current + previous month)
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

  const { data: prevBankAbsences } = useQuery({
    queryKey: ["bank-absences-prev", selectedEmployee, prevRangeStart, prevRangeEnd],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .eq("deducted_from_bank", true)
        .gte("absence_date", prevRangeStart)
        .lte("absence_date", prevRangeEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  const defaultTolerances: Tolerances = { tolerance_late_minutes: 0, tolerance_overtime_minutes: 0, tolerance_early_leave_minutes: 0 };

  const rows = useMemo(() => {
    if (!records || !templateDays) return [];

    const tolerances = selectedTemplate || defaultTolerances;
    const scheduleMap = new Map<number, (typeof templateDays)[0]>();
    templateDays.forEach((d) => scheduleMap.set(d.day_of_week, d));

    const recordMap = new Map<string, (typeof records)[0]>();
    records.forEach((r) => recordMap.set(r.record_date, r));

    const bankAbsenceSet = new Set<string>();
    bankAbsences?.forEach((a) => bankAbsenceSet.add(a.absence_date));

    const days = eachDayOfInterval({
      start: new Date(selectedYear, selectedMonth, 1),
      end: endOfMonth(new Date(selectedYear, selectedMonth, 1)),
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

      // Bank deduction
      if (isBankDeduction && schedule && !schedule.is_day_off) {
        const scheduledWork = scheduledWorkMinutes(schedule);

        result.push({
          date: dateStr,
          dayName: format(d, "EEEE", { locale: pt }),
          scheduled: scheduledWork,
          worked: 0,
          diff: -scheduledWork,
          isDayOff: false,
          isBankDeduction: true,
          schedClockIn: schedule.clock_in_time,
          schedClockOut: schedule.clock_out_time,
          schedLunchOut: schedule.lunch_out_time,
          schedLunchIn: schedule.lunch_in_time,
        });
        continue;
      }

      // Day off / no schedule → ignore entirely (respect folga, no credit/deficit)
      if (!schedule || schedule.is_day_off) {
        continue;
      }

      const partTime = isPartTimeSchedule(schedule);
      const calculated = calculateWorkday(record, schedule, tolerances);
      const normalized = calculated.normalized;
      const effectiveClockOut = partTime ? (normalized.lunch_out || normalized.clock_out) : normalized.clock_out;

      result.push({
        date: dateStr,
        dayName: format(d, "EEEE", { locale: pt }),
        scheduled: calculated.scheduled,
        worked: calculated.worked,
        diff: calculated.diff,
        isDayOff: false,
        incomplete: calculated.incomplete,
        clockIn: normalized.clock_in ?? null,
        clockOut: effectiveClockOut ?? null,
        lunchOut: partTime ? null : (normalized.lunch_out ?? null),
        lunchIn: partTime ? null : (normalized.lunch_in ?? null),
        schedClockIn: schedule.clock_in_time,
        schedClockOut: partTime ? schedule.lunch_out_time : schedule.clock_out_time,
        schedLunchOut: partTime ? undefined : schedule.lunch_out_time,
        schedLunchIn: partTime ? undefined : schedule.lunch_in_time,
      });
    }

    return result;
  }, [records, templateDays, bankAbsences, selectedTemplate, selectedMonth, selectedYear]);

  const totalBalance = rows.reduce((sum, r) => sum + r.diff, 0);
  const totalOvertime = rows.reduce((sum, r) => sum + Math.max(0, r.diff), 0);
  const totalDeficit = rows.reduce((sum, r) => sum + Math.min(0, r.diff), 0);

  // Calculate previous month balance
  const prevMonthBalance = useMemo(() => {
    if (!prevRecords || !templateDays) return 0;

    const tolerances = selectedTemplate || defaultTolerances;
    const scheduleMap = new Map<number, (typeof templateDays)[0]>();
    templateDays.forEach((d) => scheduleMap.set(d.day_of_week, d));

    const recordMap = new Map<string, (typeof prevRecords)[0]>();
    prevRecords.forEach((r) => recordMap.set(r.record_date, r));

    const prevBankSet = new Set<string>();
    prevBankAbsences?.forEach((a) => prevBankSet.add(a.absence_date));

    const days = eachDayOfInterval({
      start: new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1),
      end: endOfMonth(prevMonthDate),
    });

    let balance = 0;
    for (const d of days) {
      const dateStr = format(d, "yyyy-MM-dd");
      const dow = d.getDay();
      const schedule = scheduleMap.get(dow);
      const record = recordMap.get(dateStr);
      const isBankDeduction = prevBankSet.has(dateStr);

      if (isBankDeduction && schedule && !schedule.is_day_off) {
        const scheduledWork = scheduledWorkMinutes(schedule);
        balance -= scheduledWork;
        continue;
      }

      if (!schedule || schedule.is_day_off) {
        continue;
      }

      const pt = isPartTimeSchedule(schedule);
      balance += calculateWorkday(record, schedule, tolerances).diff;
    }

    return balance;
  }, [prevRecords, templateDays, prevBankAbsences, selectedTemplate, prevMonthDate]);

  // Only sum prev + current when the month is closed (past month)
  const isCurrentMonth = selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear();
  const accumulatedBalance = isCurrentMonth ? prevMonthBalance : prevMonthBalance + totalBalance;

  // ---- Summary for all employees ----
  const { data: allRecords } = useQuery({
    queryKey: ["overtime-all-records", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("employee_id, record_date, clock_in, clock_out, lunch_out, lunch_in")
        .gte("record_date", rangeStart)
        .lte("record_date", rangeEnd);
      if (error) throw error;
      return data;
    },
  });

  const { data: allPrevRecords } = useQuery({
    queryKey: ["overtime-all-records-prev", prevRangeStart, prevRangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("employee_id, record_date, clock_in, clock_out, lunch_out, lunch_in")
        .gte("record_date", prevRangeStart)
        .lte("record_date", prevRangeEnd);
      if (error) throw error;
      return data;
    },
  });

  const { data: allTemplateDays } = useQuery({
    queryKey: ["overtime-all-template-days"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_template_days").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: allTemplates } = useQuery({
    queryKey: ["overtime-all-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("id, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes");
      if (error) throw error;
      return data;
    },
  });

  const { data: allBankAbsences } = useQuery({
    queryKey: ["overtime-all-bank-absences", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, absence_date")
        .eq("deducted_from_bank", true)
        .gte("absence_date", rangeStart)
        .lte("absence_date", rangeEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allPrevBankAbsences } = useQuery({
    queryKey: ["overtime-all-bank-absences-prev", prevRangeStart, prevRangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, absence_date")
        .eq("deducted_from_bank", true)
        .gte("absence_date", prevRangeStart)
        .lte("absence_date", prevRangeEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  const summaryPerEmployee = useMemo(() => {
    if (!employees || !allRecords || !allTemplateDays || !allTemplates) return [];

    const templateDayMap = new Map<string, Map<number, (typeof allTemplateDays)[0]>>();
    allTemplateDays.forEach((td) => {
      if (!templateDayMap.has(td.template_id)) templateDayMap.set(td.template_id, new Map());
      templateDayMap.get(td.template_id)!.set(td.day_of_week, td);
    });

    const toleranceMap = new Map<string, Tolerances>();
    allTemplates.forEach((t) => toleranceMap.set(t.id, t));

    function calcEmpBalance(
      empId: string,
      templateId: string | null,
      recs: typeof allRecords,
      absences: any[] | undefined,
      monthStart: Date,
      monthEnd: Date
    ): number {
      const schedMap = templateId ? templateDayMap.get(templateId) : null;
      if (!schedMap) return 0;
      const tolerances = templateId ? (toleranceMap.get(templateId) || defaultTolerances) : defaultTolerances;

      const recordMap = new Map<string, (typeof recs)[0]>();
      recs.filter((r) => r.employee_id === empId).forEach((r) => recordMap.set(r.record_date, r));

      const bankDates = new Set<string>();
      absences?.filter((a) => a.employee_id === empId).forEach((a) => bankDates.add(a.absence_date));

      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const today = format(new Date(), "yyyy-MM-dd");

      let balance = 0;
      for (const d of days) {
        const dateStr = format(d, "yyyy-MM-dd");
        if (dateStr > today) continue;
        const dow = d.getDay();
        const sched = schedMap.get(dow);
        const rec = recordMap.get(dateStr);
        const isBankDeduction = bankDates.has(dateStr);

        if (isBankDeduction && sched && !sched.is_day_off) {
          const scheduled = scheduledWorkMinutes(sched);
          balance -= scheduled;
          continue;
        }
        if (!sched || sched.is_day_off) {
          continue;
        }
        balance += calculateWorkday(rec, sched, tolerances).diff;
      }
      return balance;
    }

    const curStart = new Date(selectedYear, selectedMonth, 1);
    const curEnd = endOfMonth(curStart);
    const pStart = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const pEnd = endOfMonth(pStart);

    return employees.map((emp) => {
      const curBalance = calcEmpBalance(emp.id, emp.schedule_template_id, allRecords, allBankAbsences, curStart, curEnd);
      const pBalance = allPrevRecords
        ? calcEmpBalance(emp.id, emp.schedule_template_id, allPrevRecords, allPrevBankAbsences, pStart, pEnd)
        : 0;
      const isCurMonth = selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear();
      return { ...emp, balance: curBalance, prevBalance: pBalance, accumulated: isCurMonth ? pBalance : pBalance + curBalance };
    });
  }, [employees, allRecords, allPrevRecords, allTemplateDays, allTemplates, allBankAbsences, allPrevBankAbsences, selectedMonth, selectedYear, prevMonthDate]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: format(new Date(2024, i), "MMMM", { locale: pt }),
  }));

  const years = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - 2 + i));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banco de Horas</h1>
          <p className="text-muted-foreground">Controlo de horas extra por funcionário (com tolerâncias aplicadas)</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEmployee || "all"} onValueChange={(v) => setSelectedEmployee(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Todos os funcionários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funcionários</SelectItem>
              {employees?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEmployee && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee("")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}
        </div>

        {/* Summary table */}
        {!selectedEmployee && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Resumo Mensal — {months[parseInt(month)].label} {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">Saldo Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryPerEmployee?.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmployee(e.id)}>
                      <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.accumulated > 0 ? "default" : e.accumulated < 0 ? "destructive" : "secondary"} className="font-mono font-bold">
                          {minutesToHHMM(e.accumulated)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!summaryPerEmployee || summaryPerEmployee.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">Sem dados disponíveis</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Detail view */}
        {selectedEmployee && emp && (
          <>
            {selectedTemplate && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Tolerância atraso: <strong>{selectedTemplate.tolerance_late_minutes}min</strong></span>
                <span>Tolerância extra: <strong>{selectedTemplate.tolerance_overtime_minutes}min</strong></span>
                <span>Tolerância saída antecipada: <strong>{selectedTemplate.tolerance_early_leave_minutes}min</strong></span>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2.5">
                      <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mês Anterior</p>
                      <p className={`text-xl font-bold font-mono ${prevMonthBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {minutesToHHMM(prevMonthBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Horas Extra</p>
                      <p className="text-xl font-bold font-mono text-primary">
                        +{String(Math.floor(totalOvertime / 60)).padStart(2, "0")}:{String(totalOvertime % 60).padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-destructive/10 p-2.5">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Défice</p>
                      <p className="text-xl font-bold font-mono text-destructive">{minutesToHHMM(totalDeficit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-accent p-2.5">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Mensal</p>
                      <p className={`text-xl font-bold font-mono ${totalBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {minutesToHHMM(totalBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/20 p-2.5">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {isCurrentMonth ? "Saldo Transitado" : "Saldo Acumulado (Fechado)"}
                      </p>
                      <p className={`text-xl font-bold font-mono ${accumulatedBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {minutesToHHMM(accumulatedBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{emp.first_name} {emp.last_name} — Detalhe Diário</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead className="text-right">Saldo Acum.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => {
                      const accumulated = rows.slice(0, i + 1).reduce((s, x) => s + x.diff, 0);
                      const isExpanded = expandedDate === r.date;
                      return (
                        <>
                          <TableRow
                            key={r.date}
                            className={`cursor-pointer ${r.isDayOff ? "bg-muted/30" : r.isBankDeduction ? "bg-destructive/5" : ""}`}
                            onClick={() => setExpandedDate(isExpanded ? null : r.date)}
                          >
                            <TableCell className="w-8 px-2">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{format(new Date(r.date + "T12:00:00"), "dd/MM")}</TableCell>
                            <TableCell className="capitalize text-sm">
                              {r.dayName}
                              {r.isDayOff && <Badge variant="outline" className="ml-2 text-[10px]">Folga</Badge>}
                              {r.isBankDeduction && <Badge variant="outline" className="ml-2 text-[10px] border-destructive text-destructive">Falta (Banco)</Badge>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {String(Math.floor(r.scheduled / 60)).padStart(2, "0")}:{String(r.scheduled % 60).padStart(2, "0")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {String(Math.floor(r.worked / 60)).padStart(2, "0")}:{String(r.worked % 60).padStart(2, "0")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={r.diff > 0 ? "default" : r.diff < 0 ? "destructive" : "secondary"} className="font-mono text-xs">
                                {minutesToHHMM(r.diff)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-mono text-sm font-semibold ${accumulated >= 0 ? "text-primary" : "text-destructive"}`}>
                                {minutesToHHMM(accumulated)}
                              </span>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${r.date}-detail`} className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={7} className="py-3 px-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Entrada</p>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium">{formatTs(r.clockIn ?? null)}</span>
                                      {r.schedClockIn && <span className="text-muted-foreground text-xs">(prev: {r.schedClockIn?.slice(0, 5)})</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Saída Almoço</p>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium">{formatTs(r.lunchOut ?? null)}</span>
                                      {r.schedLunchOut && <span className="text-muted-foreground text-xs">(prev: {r.schedLunchOut?.slice(0, 5)})</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Regresso Almoço</p>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium">{formatTs(r.lunchIn ?? null)}</span>
                                      {r.schedLunchIn && <span className="text-muted-foreground text-xs">(prev: {r.schedLunchIn?.slice(0, 5)})</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Saída</p>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium">{formatTs(r.clockOut ?? null)}</span>
                                      {r.schedClockOut && <span className="text-muted-foreground text-xs">(prev: {r.schedClockOut?.slice(0, 5)})</span>}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem registos para este período</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
