import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { pt } from "date-fns/locale";

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

type DayRow = {
  date: string;
  dayName: string;
  scheduled: number;
  worked: number;
  diff: number;
  isDayOff: boolean;
  incomplete?: boolean;
  isBankDeduction?: boolean;
};

export default function OvertimeBank() {
  const currentDate = new Date();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
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

  // Fetch bank-deducted absences for selected employee
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

  const rows = useMemo(() => {
    if (!records || !templateDays) return [];

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

      // Bank deduction: absence deducted from overtime bank
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
          result.push({ date: dateStr, dayName: format(d, "EEEE", { locale: pt }), scheduled: 0, worked, diff: worked, isDayOff: true });
        }
        continue;
      }

      // Working day without record → IGNORE (0h), not deficit
      if (!record?.clock_in || !record?.clock_out) {
        continue;
      }

      // Normal working day with record
      const scheduledWork =
        timeToMinutes(schedule.clock_out_time) -
        timeToMinutes(schedule.clock_in_time) -
        (timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time));

      let worked = tsToMinutes(record.clock_out) - tsToMinutes(record.clock_in);
      if (record.lunch_out && record.lunch_in) {
        worked -= tsToMinutes(record.lunch_in) - tsToMinutes(record.lunch_out);
      }

      result.push({
        date: dateStr,
        dayName: format(d, "EEEE", { locale: pt }),
        scheduled: scheduledWork,
        worked,
        diff: worked - scheduledWork,
        isDayOff: false,
      });
    }

    return result;
  }, [records, templateDays, bankAbsences, selectedMonth, selectedYear]);

  const totalBalance = rows.reduce((sum, r) => sum + r.diff, 0);
  const totalOvertime = rows.reduce((sum, r) => sum + Math.max(0, r.diff), 0);
  const totalDeficit = rows.reduce((sum, r) => sum + Math.min(0, r.diff), 0);

  // Summary per employee (all employees)
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

  const { data: allTemplateDays } = useQuery({
    queryKey: ["overtime-all-template-days"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_template_days").select("*");
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
        .eq("deducted_from_bank" as any, true)
        .gte("absence_date", rangeStart)
        .lte("absence_date", rangeEnd);
      if (error) throw error;
      return data;
    },
  });

  const summaryPerEmployee = useMemo(() => {
    if (!employees || !allRecords || !allTemplateDays) return [];

    const templateMap = new Map<string, Map<number, (typeof allTemplateDays)[0]>>();
    allTemplateDays.forEach((td) => {
      if (!templateMap.has(td.template_id)) templateMap.set(td.template_id, new Map());
      templateMap.get(td.template_id)!.set(td.day_of_week, td);
    });

    // Bank absence lookup: employee_id -> Set of dates
    const bankAbsMap = new Map<string, Set<string>>();
    allBankAbsences?.forEach((a) => {
      if (!bankAbsMap.has(a.employee_id)) bankAbsMap.set(a.employee_id, new Set());
      bankAbsMap.get(a.employee_id)!.add(a.absence_date);
    });

    const today = format(new Date(), "yyyy-MM-dd");

    return employees.map((emp) => {
      const empRecords = allRecords.filter((r) => r.employee_id === emp.id);
      const schedMap = emp.schedule_template_id ? templateMap.get(emp.schedule_template_id) : null;
      if (!schedMap) return { ...emp, balance: 0 };

      const recordMap = new Map<string, (typeof empRecords)[0]>();
      empRecords.forEach((r) => recordMap.set(r.record_date, r));

      const empBankDates = bankAbsMap.get(emp.id) || new Set<string>();

      const days = eachDayOfInterval({
        start: new Date(selectedYear, selectedMonth, 1),
        end: endOfMonth(new Date(selectedYear, selectedMonth, 1)),
      }).filter((d) => format(d, "yyyy-MM-dd") <= today);

      let balance = 0;
      for (const d of days) {
        const dateStr = format(d, "yyyy-MM-dd");
        const dow = d.getDay();
        const sched = schedMap.get(dow);
        const rec = recordMap.get(dateStr);
        const isBankDeduction = empBankDates.has(dateStr);

        // Bank deduction
        if (isBankDeduction && sched && !sched.is_day_off) {
          const scheduled =
            timeToMinutes(sched.clock_out_time) -
            timeToMinutes(sched.clock_in_time) -
            (timeToMinutes(sched.lunch_in_time) - timeToMinutes(sched.lunch_out_time));
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

        // No record → ignore
        if (!rec?.clock_in || !rec?.clock_out) continue;

        const scheduled =
          timeToMinutes(sched.clock_out_time) -
          timeToMinutes(sched.clock_in_time) -
          (timeToMinutes(sched.lunch_in_time) - timeToMinutes(sched.lunch_out_time));

        let worked = tsToMinutes(rec.clock_out) - tsToMinutes(rec.clock_in);
        if (rec.lunch_out && rec.lunch_in) worked -= tsToMinutes(rec.lunch_in) - tsToMinutes(rec.lunch_out);
        balance += worked - scheduled;
      }

      return { ...emp, balance };
    });
  }, [employees, allRecords, allTemplateDays, allBankAbsences, selectedMonth, selectedYear]);

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
          <p className="text-muted-foreground">Controlo de horas extra por funcionário</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
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
                <SelectItem key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEmployee && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee("")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}
        </div>

        {/* Summary table when no employee selected */}
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
                    <TableHead className="text-right">Saldo Mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryPerEmployee?.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedEmployee(e.id)}
                    >
                      <TableCell className="font-medium">
                        {e.first_name} {e.last_name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={e.balance > 0 ? "default" : e.balance < 0 ? "destructive" : "secondary"}
                          className="font-mono"
                        >
                          {minutesToHHMM(e.balance)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!summaryPerEmployee || summaryPerEmployee.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Sem dados disponíveis
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Detail view for selected employee */}
        {selectedEmployee && emp && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Horas Extra</p>
                      <p className="text-xl font-bold font-mono text-primary">
                        +{String(Math.floor(totalOvertime / 60)).padStart(2, "0")}:
                        {String(totalOvertime % 60).padStart(2, "0")}
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
                      <p className="text-xl font-bold font-mono text-destructive">
                        {minutesToHHMM(totalDeficit)}
                      </p>
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
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {emp.first_name} {emp.last_name} — Detalhe Diário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
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
                      return (
                        <TableRow key={r.date} className={r.isDayOff ? "bg-muted/30" : r.isBankDeduction ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-sm">{format(new Date(r.date + "T12:00:00"), "dd/MM")}</TableCell>
                          <TableCell className="capitalize text-sm">
                            {r.dayName}
                            {r.isDayOff && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                Folga
                              </Badge>
                            )}
                            {r.isBankDeduction && (
                              <Badge variant="outline" className="ml-2 text-[10px] border-destructive text-destructive">
                                Falta (Banco)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {String(Math.floor(r.scheduled / 60)).padStart(2, "0")}:
                            {String(r.scheduled % 60).padStart(2, "0")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {String(Math.floor(r.worked / 60)).padStart(2, "0")}:
                            {String(r.worked % 60).padStart(2, "0")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={r.diff > 0 ? "default" : r.diff < 0 ? "destructive" : "secondary"}
                              className="font-mono text-xs"
                            >
                              {minutesToHHMM(r.diff)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono text-sm font-semibold ${accumulated >= 0 ? "text-primary" : "text-destructive"}`}>
                              {minutesToHHMM(accumulated)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Sem registos para este período
                        </TableCell>
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
