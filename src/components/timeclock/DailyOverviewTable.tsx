import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "HH:mm");
}

interface Props {
  onSelectEmployee: (id: string) => void;
}

export function DailyOverviewTable({ onSelectEmployee }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: employees } = useQuery({
    queryKey: ["employees-active-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, schedule_template_id")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records } = useQuery({
    queryKey: ["time-clock-overview", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("*")
        .eq("record_date", dateStr);
      if (error) throw error;
      return data;
    },
  });

  const { data: templateDays } = useQuery({
    queryKey: ["schedule-template-days-overview", date.getDay()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template_days")
        .select("*")
        .eq("day_of_week", date.getDay());
      if (error) throw error;
      return data;
    },
  });

  const recordMap = new Map((records || []).map((r) => [r.employee_id, r]));
  const schedMap = new Map((templateDays || []).map((d: any) => [d.template_id, d]));

  const rows = (employees || []).map((emp) => {
    const rec = recordMap.get(emp.id);
    const sched = emp.schedule_template_id ? schedMap.get(emp.schedule_template_id) : null;
    const isDayOff = sched?.is_day_off ?? (date.getDay() === 0 || date.getDay() === 6);

    let status: "ok" | "missing" | "incomplete" | "dayoff" = isDayOff ? "dayoff" : "missing";
    if (rec) {
      status = rec.clock_out ? "ok" : "incomplete";
    }

    return {
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      position: emp.position,
      clockIn: rec?.clock_in ?? null,
      lunchOut: rec?.lunch_out ?? null,
      lunchIn: rec?.lunch_in ?? null,
      clockOut: rec?.clock_out ?? null,
      scheduledIn: sched && !isDayOff ? sched.clock_in_time : null,
      status,
    };
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "ok": return <Badge variant="outline" className="text-xs text-green-600 border-green-500">Completo</Badge>;
      case "incomplete": return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Incompleto</Badge>;
      case "missing": return <Badge variant="destructive" className="text-xs">Sem registo</Badge>;
      case "dayoff": return <Badge variant="secondary" className="text-xs">Folga</Badge>;
      default: return null;
    }
  };

  const summary = {
    total: rows.filter(r => r.status !== "dayoff").length,
    ok: rows.filter(r => r.status === "ok").length,
    incomplete: rows.filter(r => r.status === "incomplete").length,
    missing: rows.filter(r => r.status === "missing").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <div className="flex gap-3 text-sm">
          <span className="text-muted-foreground">
            <Users className="inline h-4 w-4 mr-1" />
            {summary.total} funcionários
          </span>
          <span className="text-green-600 font-medium">{summary.ok} completos</span>
          <span className="text-amber-600 font-medium">{summary.incomplete} incompletos</span>
          <span className="text-destructive font-medium">{summary.missing} sem registo</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Vista Geral — {format(date, "EEEE, dd 'de' MMMM", { locale: pt })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída Almoço</TableHead>
                <TableHead>Retorno Almoço</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Horário Previsto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum funcionário ativo</TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      row.status === "dayoff" && "opacity-50",
                      row.status === "missing" && "bg-destructive/5"
                    )}
                    onClick={() => onSelectEmployee(row.id)}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.position}</TableCell>
                    <TableCell>{formatTime(row.clockIn)}</TableCell>
                    <TableCell>{formatTime(row.lunchOut)}</TableCell>
                    <TableCell>{formatTime(row.lunchIn)}</TableCell>
                    <TableCell>{formatTime(row.clockOut)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.scheduledIn ? row.scheduledIn.slice(0, 5) : "—"}</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
