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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Users, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "HH:mm");
}

interface Props {
  onSelectEmployee: (id: string) => void;
}

export function DailyOverviewTable({ onSelectEmployee }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [departmentId, setDepartmentId] = useState<string>("all");
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: departments } = useQuery({
    queryKey: ["departments-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-active-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, schedule_template_id, department_id")
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

  const filteredEmployees = (employees || []).filter((emp) =>
    departmentId === "all" ? true : emp.department_id === departmentId
  );

  const rows = filteredEmployees.map((emp) => {
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

  const statusLabel = (s: string) => {
    switch (s) {
      case "ok": return "Completo";
      case "incomplete": return "Incompleto";
      case "missing": return "Sem registo";
      case "dayoff": return "Folga";
      default: return "";
    }
  };

  const summary = {
    total: rows.filter(r => r.status !== "dayoff").length,
    ok: rows.filter(r => r.status === "ok").length,
    incomplete: rows.filter(r => r.status === "incomplete").length,
    missing: rows.filter(r => r.status === "missing").length,
  };

  const exportHeaders = ["Funcionário", "Cargo", "Entrada", "Saída Almoço", "Retorno Almoço", "Saída", "Horário Previsto", "Status"];

  const getExportRows = useCallback(() => {
    return rows.map((r) => [
      r.name,
      r.position,
      formatTime(r.clockIn),
      formatTime(r.lunchOut),
      formatTime(r.lunchIn),
      formatTime(r.clockOut),
      r.scheduledIn ? r.scheduledIn.slice(0, 5) : "—",
      statusLabel(r.status),
    ]);
  }, [rows]);

  const handleExportExcel = useCallback(async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Ponto");
    ws.addRow(exportHeaders);
    getExportRows().forEach((row) => ws.addRow(row));
    ws.columns.forEach((col) => { col.width = 18; });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ponto_${dateStr}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getExportRows, dateStr]);

  const handleExportPdf = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = `Relatório de Ponto — ${format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}`;
    doc.setFontSize(14);
    doc.text(title, 14, 18);
    doc.setFontSize(9);
    doc.text(`Total: ${summary.total} | Completos: ${summary.ok} | Incompletos: ${summary.incomplete} | Sem registo: ${summary.missing}`, 14, 26);

    const dataRows = getExportRows();
    const startY = 34;
    const colWidths = [50, 35, 22, 28, 28, 22, 28, 25];
    const rowH = 7;

    // header
    doc.setFillColor(240, 240, 240);
    doc.rect(14, startY - 5, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    let x = 14;
    exportHeaders.forEach((h, i) => {
      doc.text(h, x + 1, startY);
      x += colWidths[i];
    });

    // rows
    doc.setFont("helvetica", "normal");
    dataRows.forEach((row, ri) => {
      const y = startY + (ri + 1) * rowH;
      if (y > 190) return; // page overflow guard
      x = 14;
      row.forEach((cell, ci) => {
        doc.text(String(cell), x + 1, y);
        x += colWidths[ci];
      });
    });

    doc.save(`ponto_${dateStr}.pdf`);
  }, [getExportRows, date, dateStr, summary]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
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

        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {(departments || []).map((dep) => (
              <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-3 text-sm">
          <span className="text-muted-foreground">
            <Users className="inline h-4 w-4 mr-1" />
            {summary.total} funcionários
          </span>
          <span className="text-green-600 font-medium">{summary.ok} completos</span>
          <span className="text-amber-600 font-medium">{summary.incomplete} incompletos</span>
          <span className="text-destructive font-medium">{summary.missing} sem registo</span>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Employees WITH records */}
      {(() => {
        const withRecord = rows.filter((r) => r.status === "ok" || r.status === "incomplete");
        const withoutRecord = rows.filter((r) => r.status === "missing");
        const dayOff = rows.filter((r) => r.status === "dayoff");

        const renderTable = (title: string, data: typeof rows, icon?: React.ReactNode) => (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {icon || <Users className="h-4 w-4" />}
                {title}
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
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum funcionário</TableCell>
                    </TableRow>
                  ) : (
                    data.map((row) => (
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
        );

        return (
          <div className="space-y-4">
            {renderTable(
              `Com Registo — ${format(date, "EEEE, dd 'de' MMMM", { locale: pt })} (${withRecord.length})`,
              withRecord,
              <Users className="h-4 w-4 text-green-600" />
            )}
            {renderTable(
              `Sem Registo (${withoutRecord.length})`,
              withoutRecord,
              <Users className="h-4 w-4 text-destructive" />
            )}
            {dayOff.length > 0 && renderTable(
              `De Folga (${dayOff.length})`,
              dayOff,
              <Users className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
      })()}
    </div>
  );
}
