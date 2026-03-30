import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, AlertTriangle, Timer, Pencil, Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimeClockRecordDialog } from "@/components/timeclock/TimeClockRecordDialog";
import { DailyOverviewTable } from "@/components/timeclock/DailyOverviewTable";
import { MonthlyExportDialog } from "@/components/timeclock/MonthlyExportDialog";

type PeriodType = "day" | "week" | "month";

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "HH:mm");
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function tsToMinutes(ts: string): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.round(Math.abs(mins) % 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export default function TimeClockReport() {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [period, setPeriod] = useState<PeriodType>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editDialog, setEditDialog] = useState<{ open: boolean; record?: any; date?: string }>({ open: false });

  const dateRange = useMemo(() => {
    if (period === "day") return { start: selectedDate, end: selectedDate };
    if (period === "week") return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
    return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
  }, [period, selectedDate]);

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
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

  const { data: records, isLoading } = useQuery({
    queryKey: ["time-clock-report", employeeId, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("record_date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("record_date", format(dateRange.end, "yyyy-MM-dd"))
        .order("record_date");
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  const selectedEmployee = employees?.find((e) => e.id === employeeId);

  const { data: scheduleData } = useQuery({
    queryKey: ["schedule-for-report", selectedEmployee?.schedule_template_id],
    queryFn: async () => {
      if (!selectedEmployee?.schedule_template_id) return null;
      const [{ data: template }, { data: days }] = await Promise.all([
        supabase.from("schedule_templates").select("*").eq("id", selectedEmployee.schedule_template_id).single(),
        supabase.from("schedule_template_days").select("*").eq("template_id", selectedEmployee.schedule_template_id),
      ]);
      return { template, days };
    },
    enabled: !!selectedEmployee?.schedule_template_id,
  });

  const reportRows = useMemo(() => {
    if (!employeeId || !records) return [];
    const allDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const recordMap = new Map(records.map((r) => [r.record_date, r]));
    const dayScheduleMap = new Map((scheduleData?.days || []).map((d: any) => [d.day_of_week, d]));
    const tol = scheduleData?.template;

    return allDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dow = day.getDay();
      const sched = dayScheduleMap.get(dow);
      const rec = recordMap.get(dateStr);
      const isDayOff = sched?.is_day_off ?? true;

      // Detect part-time schedule (lunch_in=00:00, clock_out=00:00)
      const partTime = sched && !sched.is_day_off && sched.lunch_in_time === "00:00:00" && sched.clock_out_time === "00:00:00";
      // For part-time, the effective clock_out is stored in lunch_out field
      const effectiveClockOut = partTime ? rec?.lunch_out : rec?.clock_out;

      let workedMinutes = 0;
      let overtimeMinutes = 0;
      let lateMinutes = 0;
      let status: "normal" | "late" | "overtime" | "absent" | "dayoff" | "incomplete" = isDayOff ? "dayoff" : "absent";

      if (rec && rec.clock_in) {
        if (effectiveClockOut) {
          workedMinutes = (new Date(effectiveClockOut).getTime() - new Date(rec.clock_in).getTime()) / 60000;
          if (!partTime && rec.lunch_out && rec.lunch_in) {
            workedMinutes -= (new Date(rec.lunch_in).getTime() - new Date(rec.lunch_out).getTime()) / 60000;
          }
          workedMinutes = Math.max(0, workedMinutes);
          status = "normal";

          if (sched && tol) {
            const clockInMin = tsToMinutes(rec.clock_in);
            const schedClockIn = timeToMinutes(sched.clock_in_time);
            const late = clockInMin - schedClockIn - (tol.tolerance_late_minutes || 0);
            if (late > 0) {
              lateMinutes = late;
              status = "late";
            }

            const clockOutMin = tsToMinutes(effectiveClockOut);
            const schedClockOut = partTime ? timeToMinutes(sched.lunch_out_time) : timeToMinutes(sched.clock_out_time);
            const ot = clockOutMin - schedClockOut - (tol.tolerance_overtime_minutes || 0);
            if (ot > 0) {
              overtimeMinutes = ot;
              if (status === "normal") status = "overtime";
            }
          }
        } else {
          status = "incomplete";
          workedMinutes = 0;
        }
      }

      return {
        date: dateStr,
        dayLabel: format(day, "EEE, dd/MM", { locale: pt }),
        isDayOff,
        clockIn: rec?.clock_in ?? null,
        lunchOut: rec?.lunch_out ?? null,
        lunchIn: rec?.lunch_in ?? null,
        clockOut: partTime ? (rec?.lunch_out ?? null) : (rec?.clock_out ?? null),
        workedMinutes,
        overtimeMinutes,
        lateMinutes,
        status,
        record: rec || null,
      };
    });
  }, [records, employeeId, dateRange, scheduleData]);

  const summary = useMemo(() => {
    const workDays = reportRows.filter((r) => !r.isDayOff);
    return {
      totalWorked: workDays.reduce((s, r) => s + r.workedMinutes, 0),
      totalOvertime: workDays.reduce((s, r) => s + r.overtimeMinutes, 0),
      totalLate: workDays.reduce((s, r) => s + r.lateMinutes, 0),
      absences: workDays.filter((r) => r.status === "absent").length,
    };
  }, [reportRows]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "late": return <Badge variant="destructive" className="text-xs">Atrasado</Badge>;
      case "overtime": return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Hora Extra</Badge>;
      case "absent": return <Badge variant="outline" className="text-xs text-destructive border-destructive">Falta</Badge>;
      case "dayoff": return <Badge variant="secondary" className="text-xs">Folga</Badge>;
      case "incomplete": return <Badge variant="outline" className="text-xs">Incompleto</Badge>;
      default: return <Badge variant="outline" className="text-xs text-green-600 border-green-500">Normal</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Relatório de Ponto</h1>
              <p className="text-muted-foreground text-sm">Registros de ponto por funcionário com cálculo de horas</p>
            </div>
            <MonthlyExportDialog />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          {employeeId && (
            <Button variant="ghost" size="sm" onClick={() => setEmployeeId("")} className="self-end">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Vista Geral
            </Button>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Funcionário</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Período</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {employeeId && (
            <Button size="sm" onClick={() => setEditDialog({ open: true, date: format(selectedDate, "yyyy-MM-dd") })}>
              <Plus className="h-4 w-4 mr-1" />
              Criar Registo
            </Button>
          )}
        </div>

        {employeeId && (
          <p className="text-sm text-muted-foreground">
            Período: {format(dateRange.start, "dd/MM/yyyy")} a {format(dateRange.end, "dd/MM/yyyy")}
          </p>
        )}

        {/* Summary Cards */}
        {employeeId && reportRows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" />Total Trabalhado</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{minutesToHHMM(summary.totalWorked)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Timer className="h-4 w-4" />Horas Extras</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-amber-600">{minutesToHHMM(summary.totalOvertime)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Atrasos</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{minutesToHHMM(summary.totalLate)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Faltas</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{summary.absences}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        {employeeId && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                     <TableHead>Entrada</TableHead>
                     <TableHead>Saída Almoço</TableHead>
                     <TableHead>Retorno Almoço</TableHead>
                     <TableHead>Saída</TableHead>
                     <TableHead>Total Horas</TableHead>
                     <TableHead>Hora Extra</TableHead>
                     <TableHead>Atraso</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Observações</TableHead>
                     <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                   ) : reportRows.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                  ) : (
                    reportRows.map((row) => (
                      <TableRow key={row.date} className={row.isDayOff ? "opacity-50" : row.status === "absent" ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{row.dayLabel}</TableCell>
                        <TableCell>{formatTime(row.clockIn)}</TableCell>
                        <TableCell>{formatTime(row.lunchOut)}</TableCell>
                        <TableCell>{formatTime(row.lunchIn)}</TableCell>
                        <TableCell>{formatTime(row.clockOut)}</TableCell>
                        <TableCell>{row.workedMinutes > 0 ? minutesToHHMM(row.workedMinutes) : "—"}</TableCell>
                        <TableCell className={row.overtimeMinutes > 0 ? "text-amber-600 font-medium" : ""}>
                          {row.overtimeMinutes > 0 ? minutesToHHMM(row.overtimeMinutes) : "—"}
                        </TableCell>
                        <TableCell className={row.lateMinutes > 0 ? "text-destructive font-medium" : ""}>
                          {row.lateMinutes > 0 ? minutesToHHMM(row.lateMinutes) : "—"}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditDialog({
                              open: true,
                              record: row.record ? {
                                id: row.record.id,
                                employee_id: employeeId,
                                record_date: row.date,
                                clock_in: row.record.clock_in,
                                lunch_out: row.record.lunch_out,
                                lunch_in: row.record.lunch_in,
                                clock_out: row.record.clock_out,
                                notes: row.record.notes,
                              } : undefined,
                              date: row.date,
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!employeeId && (
          <DailyOverviewTable onSelectEmployee={(id) => setEmployeeId(id)} />
        )}
      </div>

      {employeeId && selectedEmployee && (
        <TimeClockRecordDialog
          open={editDialog.open}
          onClose={() => setEditDialog({ open: false })}
          employeeId={employeeId}
          employeeName={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
          record={editDialog.record}
          date={editDialog.date}
        />
      )}
    </AppLayout>
  );
}
