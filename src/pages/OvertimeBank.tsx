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

function formatTs(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function tsToMinutes(ts: string): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToHHMM(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Part-time: lunch_in and clock_out are "00:00:00", employee works clock_in → lunch_out only */
function isPartTimeSchedule(sched: any): boolean {
  if (!sched || sched.is_day_off) return false;
  return sched.lunch_in_time === "00:00:00" && sched.clock_out_time === "00:00:00";
}

type Tolerances = {
  tolerance_late_minutes: number;
  tolerance_overtime_minutes: number;
  tolerance_early_leave_minutes: number;
};

/**
 * Calculate the effective diff applying tolerances:
 * - Late arrival within tolerance → no penalty
 * - Early leave within tolerance → no penalty
 * - Overtime only counts if beyond overtime tolerance
 * - Lunch break: extra lunch time within late tolerance → no penalty;
 *   shorter lunch within overtime tolerance → no extra
 */
function calcDiffWithTolerances(
  record: { clock_in: string; clock_out: string; lunch_out: string | null; lunch_in: string | null },
  schedule: { clock_in_time: string; clock_out_time: string; lunch_out_time: string; lunch_in_time: string },
  tolerances: Tolerances
): { worked: number; diff: number } {
  const actualIn = tsToMinutes(record.clock_in);
  const actualOut = tsToMinutes(record.clock_out);
  const schedIn = timeToMinutes(schedule.clock_in_time);
  const schedOut = timeToMinutes(schedule.clock_out_time);
  const schedLunchOut = timeToMinutes(schedule.lunch_out_time);
  const schedLunchIn = timeToMinutes(schedule.lunch_in_time);
  const scheduledLunch = schedLunchIn - schedLunchOut;

  // Actual lunch calculation
  let actualLunch = scheduledLunch;
  if (record.lunch_out && record.lunch_in) {
    actualLunch = tsToMinutes(record.lunch_in) - tsToMinutes(record.lunch_out);
  }

  const worked = (actualOut - actualIn) - actualLunch;

  // --- Calculate each component independently ---

  // 1) Late arrival: full penalty if exceeds tolerance, zero if within
  const lateMinutes = Math.max(0, actualIn - schedIn);
  let entryDeficit = 0;
  if (lateMinutes > tolerances.tolerance_late_minutes) {
    entryDeficit = lateMinutes;
  }

  // 2) Exit: overtime credit or early leave deficit (mutually exclusive)
  const exitExtra = Math.max(0, actualOut - schedOut);
  const earlyLeaveMinutes = Math.max(0, schedOut - actualOut);
  let exitCredit = 0;
  let exitDeficit = 0;
  if (exitExtra > 0) {
    // Only credit if beyond overtime tolerance, and subtract tolerance
    exitCredit = exitExtra > tolerances.tolerance_overtime_minutes
      ? exitExtra - tolerances.tolerance_overtime_minutes
      : 0;
  } else if (earlyLeaveMinutes > 0) {
    // Full penalty if beyond early leave tolerance
    exitDeficit = earlyLeaveMinutes > tolerances.tolerance_early_leave_minutes
      ? earlyLeaveMinutes
      : 0;
  }

  // 3) Lunch: only penalize if returned late beyond tolerance
  let lunchPenalty = 0;
  if (record.lunch_out && record.lunch_in) {
    const actualLunchIn = tsToMinutes(record.lunch_in);
    const lunchReturnLate = Math.max(0, actualLunchIn - schedLunchIn);
    if (lunchReturnLate > tolerances.tolerance_late_minutes) {
      lunchPenalty = lunchReturnLate;
    }
  }

  const diff = exitCredit - entryDeficit - exitDeficit - lunchPenalty;

  return { worked, diff };
}

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
        const scheduledWork =
          timeToMinutes(schedule.clock_out_time) -
          timeToMinutes(schedule.clock_in_time) -
          (timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time));

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

      // Day off with work → all time is overtime
      if (!schedule || schedule.is_day_off) {
        if (record?.clock_in && record?.clock_out) {
          let worked = tsToMinutes(record.clock_out) - tsToMinutes(record.clock_in);
          if (record.lunch_out && record.lunch_in) {
            worked -= tsToMinutes(record.lunch_in) - tsToMinutes(record.lunch_out);
          }
          result.push({
            date: dateStr,
            dayName: format(d, "EEEE", { locale: pt }),
            scheduled: 0,
            worked,
            diff: worked,
            isDayOff: true,
            clockIn: record.clock_in,
            clockOut: record.clock_out,
            lunchOut: record.lunch_out,
            lunchIn: record.lunch_in,
          });
        }
        continue;
      }

      const partTime = isPartTimeSchedule(schedule);

      // For part-time, the "clock_out" is stored in lunch_out field
      const effectiveClockOut = partTime ? record?.lunch_out : record?.clock_out;

      // Working day without complete record → calculate partial work
      if (!record?.clock_in || !effectiveClockOut) {
        const scheduledWork = partTime
          ? timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time)
          : timeToMinutes(schedule.clock_out_time) -
            timeToMinutes(schedule.clock_in_time) -
            (timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time));

        // Calculate partial worked time from available punches
        let partialWorked = 0;
        if (record?.clock_in) {
          // Find the last available punch to calculate worked time
          const lastPunch = record.clock_out || record.lunch_in || record.lunch_out;
          if (lastPunch) {
            partialWorked = tsToMinutes(lastPunch) - tsToMinutes(record.clock_in);
            // Subtract lunch break if both lunch punches exist
            if (record.lunch_out && record.lunch_in) {
              partialWorked -= tsToMinutes(record.lunch_in) - tsToMinutes(record.lunch_out);
            }
            partialWorked = Math.max(0, partialWorked);
          }
        }

        result.push({
          date: dateStr,
          dayName: format(d, "EEEE", { locale: pt }),
          scheduled: scheduledWork,
          worked: partialWorked,
          diff: partialWorked - scheduledWork,
          isDayOff: false,
          incomplete: true,
          clockIn: record?.clock_in ?? null,
          clockOut: record?.clock_out ?? null,
          lunchOut: record?.lunch_out ?? null,
          lunchIn: record?.lunch_in ?? null,
          schedClockIn: schedule.clock_in_time,
          schedClockOut: partTime ? schedule.lunch_out_time : schedule.clock_out_time,
          schedLunchOut: partTime ? undefined : schedule.lunch_out_time,
          schedLunchIn: partTime ? undefined : schedule.lunch_in_time,
        });
        continue;
      }

      if (partTime) {
        // Part-time: scheduled work = lunch_out_time - clock_in_time, no lunch break
        const scheduledWork = timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time);
        const actualIn = tsToMinutes(record.clock_in);
        const actualOut = tsToMinutes(effectiveClockOut);
        const worked = actualOut - actualIn;
        const schedIn = timeToMinutes(schedule.clock_in_time);
        const schedOut = timeToMinutes(schedule.lunch_out_time);

        // Apply tolerances for entry/exit
        const rawDiff = worked - scheduledWork;
        let diff = 0;
        if (rawDiff >= 0) {
          diff = rawDiff > tolerances.tolerance_overtime_minutes ? rawDiff - tolerances.tolerance_overtime_minutes : 0;
        } else {
          const lateMinutes = Math.max(0, actualIn - schedIn);
          const earlyLeaveMinutes = Math.max(0, schedOut - actualOut);
          const toleratedLate = Math.min(lateMinutes, tolerances.tolerance_late_minutes);
          const toleratedEarly = Math.min(earlyLeaveMinutes, tolerances.tolerance_early_leave_minutes);
          diff = Math.abs(rawDiff) <= (toleratedLate + toleratedEarly) ? 0 : rawDiff;
        }

        result.push({
          date: dateStr,
          dayName: format(d, "EEEE", { locale: pt }),
          scheduled: scheduledWork,
          worked,
          diff,
          isDayOff: false,
          clockIn: record.clock_in,
          clockOut: effectiveClockOut,
          lunchOut: null,
          lunchIn: null,
          schedClockIn: schedule.clock_in_time,
          schedClockOut: schedule.lunch_out_time,
          schedLunchOut: undefined,
          schedLunchIn: undefined,
        });
      } else {
        // Normal working day with record — apply tolerances
        const scheduledWork =
          timeToMinutes(schedule.clock_out_time) -
          timeToMinutes(schedule.clock_in_time) -
          (timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time));

        const { worked, diff } = calcDiffWithTolerances(
          record as { clock_in: string; clock_out: string; lunch_out: string | null; lunch_in: string | null },
          schedule,
          tolerances
        );

        result.push({
          date: dateStr,
          dayName: format(d, "EEEE", { locale: pt }),
          scheduled: scheduledWork,
          worked,
          diff,
          isDayOff: false,
          clockIn: record.clock_in,
          clockOut: record.clock_out,
          lunchOut: record.lunch_out,
          lunchIn: record.lunch_in,
          schedClockIn: schedule.clock_in_time,
          schedClockOut: schedule.clock_out_time,
          schedLunchOut: schedule.lunch_out_time,
          schedLunchIn: schedule.lunch_in_time,
        });
      }
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
        const scheduledWork =
          timeToMinutes(schedule.clock_out_time) -
          timeToMinutes(schedule.clock_in_time) -
          (timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time));
        balance -= scheduledWork;
        continue;
      }

      if (!schedule || schedule.is_day_off) {
        if (record?.clock_in && record?.clock_out) {
          let w = tsToMinutes(record.clock_out) - tsToMinutes(record.clock_in);
          if (record.lunch_out && record.lunch_in) w -= tsToMinutes(record.lunch_in) - tsToMinutes(record.lunch_out);
          balance += w;
        }
        continue;
      }

      const pt = isPartTimeSchedule(schedule);
      const effectiveOut = pt ? record?.lunch_out : record?.clock_out;

      if (!record?.clock_in || !effectiveOut) {
        // Incomplete record → calculate partial work
        const scheduledWork = pt
          ? timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time)
          : timeToMinutes(schedule.clock_out_time) -
            timeToMinutes(schedule.clock_in_time) -
            (timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time));
        let partialWorked = 0;
        if (record?.clock_in) {
          const lastPunch = record.clock_out || record.lunch_in || record.lunch_out;
          if (lastPunch) {
            partialWorked = tsToMinutes(lastPunch) - tsToMinutes(record.clock_in);
            if (record.lunch_out && record.lunch_in) {
              partialWorked -= tsToMinutes(record.lunch_in) - tsToMinutes(record.lunch_out);
            }
            partialWorked = Math.max(0, partialWorked);
          }
        }
        balance += partialWorked - scheduledWork;
        continue;
      }

      if (pt) {
        const scheduledWork = timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time);
        const worked = tsToMinutes(effectiveOut) - tsToMinutes(record.clock_in);
        const rawDiff = worked - scheduledWork;
        let diff = 0;
        if (rawDiff >= 0) {
          diff = rawDiff > tolerances.tolerance_overtime_minutes ? rawDiff - tolerances.tolerance_overtime_minutes : 0;
        } else {
          const lateMin = Math.max(0, tsToMinutes(record.clock_in) - timeToMinutes(schedule.clock_in_time));
          const earlyMin = Math.max(0, timeToMinutes(schedule.lunch_out_time) - tsToMinutes(effectiveOut));
          const tolerated = Math.min(lateMin, tolerances.tolerance_late_minutes) + Math.min(earlyMin, tolerances.tolerance_early_leave_minutes);
          diff = Math.abs(rawDiff) <= tolerated ? 0 : rawDiff;
        }
        balance += diff;
      } else {
        const { diff } = calcDiffWithTolerances(
          record as { clock_in: string; clock_out: string; lunch_out: string | null; lunch_in: string | null },
          schedule,
          tolerances
        );
        balance += diff;
      }
    }

    return balance;
  }, [prevRecords, templateDays, prevBankAbsences, selectedTemplate, prevMonthDate]);

  const accumulatedBalance = prevMonthBalance + totalBalance;

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
          const scheduled = timeToMinutes(sched.clock_out_time) - timeToMinutes(sched.clock_in_time) - (timeToMinutes(sched.lunch_in_time) - timeToMinutes(sched.lunch_out_time));
          balance -= scheduled;
          continue;
        }
        if (!sched || sched.is_day_off) {
          if (rec?.clock_in && rec?.clock_out) {
            let w = tsToMinutes(rec.clock_out) - tsToMinutes(rec.clock_in);
            if (rec.lunch_out && rec.lunch_in) w -= tsToMinutes(rec.lunch_in) - tsToMinutes(rec.lunch_out);
            balance += w;
          }
          continue;
        }
        const pt = isPartTimeSchedule(sched);
        const effectiveOut = pt ? rec?.lunch_out : rec?.clock_out;
        if (!rec?.clock_in || !effectiveOut) {
          const scheduledWork = pt
            ? timeToMinutes(sched.lunch_out_time) - timeToMinutes(sched.clock_in_time)
            : timeToMinutes(sched.clock_out_time) - timeToMinutes(sched.clock_in_time) - (timeToMinutes(sched.lunch_in_time) - timeToMinutes(sched.lunch_out_time));
          balance -= scheduledWork;
          continue;
        }
        if (pt) {
          const scheduledWork = timeToMinutes(sched.lunch_out_time) - timeToMinutes(sched.clock_in_time);
          const worked = tsToMinutes(effectiveOut) - tsToMinutes(rec.clock_in);
          const rawDiff = worked - scheduledWork;
          let diff = 0;
          if (rawDiff >= 0) {
            diff = rawDiff > tolerances.tolerance_overtime_minutes ? rawDiff - tolerances.tolerance_overtime_minutes : 0;
          } else {
            const lateMin = Math.max(0, tsToMinutes(rec.clock_in) - timeToMinutes(sched.clock_in_time));
            const earlyMin = Math.max(0, timeToMinutes(sched.lunch_out_time) - tsToMinutes(effectiveOut));
            const tolerated = Math.min(lateMin, tolerances.tolerance_late_minutes) + Math.min(earlyMin, tolerances.tolerance_early_leave_minutes);
            diff = Math.abs(rawDiff) <= tolerated ? 0 : rawDiff;
          }
          balance += diff;
        } else {
          const { diff } = calcDiffWithTolerances(
            rec as { clock_in: string; clock_out: string; lunch_out: string | null; lunch_in: string | null },
            sched, tolerances
          );
          balance += diff;
        }
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
      return { ...emp, balance: curBalance, prevBalance: pBalance, accumulated: pBalance + curBalance };
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
                    <TableHead className="text-right">Mês Anterior</TableHead>
                    <TableHead className="text-right">Saldo Mensal</TableHead>
                    <TableHead className="text-right">Saldo Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryPerEmployee?.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmployee(e.id)}>
                      <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.prevBalance > 0 ? "default" : e.prevBalance < 0 ? "destructive" : "secondary"} className="font-mono">
                          {minutesToHHMM(e.prevBalance)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.balance > 0 ? "default" : e.balance < 0 ? "destructive" : "secondary"} className="font-mono">
                          {minutesToHHMM(e.balance)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.accumulated > 0 ? "default" : e.accumulated < 0 ? "destructive" : "secondary"} className="font-mono font-bold">
                          {minutesToHHMM(e.accumulated)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!summaryPerEmployee || summaryPerEmployee.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados disponíveis</TableCell>
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
                      <p className="text-sm text-muted-foreground font-medium">Saldo Acumulado</p>
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
