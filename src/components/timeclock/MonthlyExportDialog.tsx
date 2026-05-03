import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { pt } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { calculateWorkday, formatPunchTime, isPartTimeSchedule, minutesToHoursLabel, type Tolerances } from "@/lib/timeClock";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const minutesToHHMM = minutesToHoursLabel;

export function MonthlyExportDialog() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth());
  const [year, setYear] = useState<number>(now.getFullYear());
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const startDate = startOfMonth(new Date(year, month));
  const endDate = endOfMonth(new Date(year, month));
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const { data: departments } = useQuery({
    queryKey: ["departments-export"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, department_id, schedule_template_id, departments(name)")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredEmployees = (employees || []).filter(
    (e) => departmentId === "all" || e.department_id === departmentId
  );

  const deptName = departmentId === "all"
    ? "Todos os Setores"
    : departments?.find((d) => d.id === departmentId)?.name || "";

  const buildData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all records for the month
      const { data: allRecords, error: recErr } = await supabase
        .from("time_clock_records")
        .select("*")
        .gte("record_date", startStr)
        .lte("record_date", endStr);
      if (recErr) throw recErr;

      // Fetch schedule template days
      const templateIds = [...new Set(filteredEmployees.map((e) => e.schedule_template_id).filter(Boolean))];
      let allTemplateDays: any[] = [];
      let allTemplates: any[] = [];
      if (templateIds.length > 0) {
        const [{ data: tDays }, { data: tTemplates }] = await Promise.all([
          supabase.from("schedule_template_days").select("*").in("template_id", templateIds),
          supabase.from("schedule_templates").select("*").in("id", templateIds),
        ]);
        allTemplateDays = tDays || [];
        allTemplates = tTemplates || [];
      }

      const templateDayMap = new Map<string, Map<number, any>>();
      allTemplateDays.forEach((td) => {
        if (!templateDayMap.has(td.template_id)) templateDayMap.set(td.template_id, new Map());
        templateDayMap.get(td.template_id)!.set(td.day_of_week, td);
      });
      const templateMap = new Map(allTemplates.map((t: any) => [t.id, t]));

      const allDays = eachDayOfInterval({ start: startDate, end: endDate });

      const result: {
        empName: string;
        empPosition: string;
        empDept: string;
        days: {
          dateStr: string;
          dayLabel: string;
          clockIn: string | null;
          lunchOut: string | null;
          lunchIn: string | null;
          clockOut: string | null;
          workedMinutes: number;
          overtimeMinutes: number;
          lateMinutes: number;
          status: string;
        }[];
        totalWorked: number;
        totalOvertime: number;
        totalLate: number;
        absences: number;
      }[] = [];

      for (const emp of filteredEmployees) {
        const empRecords = (allRecords || []).filter((r) => r.employee_id === emp.id);
        const recordMap = new Map(empRecords.map((r) => [r.record_date, r]));
        const schedDays = emp.schedule_template_id ? templateDayMap.get(emp.schedule_template_id) : null;
        const tol = emp.schedule_template_id ? templateMap.get(emp.schedule_template_id) : null;

        let totalWorked = 0, totalOvertime = 0, totalLate = 0, absences = 0;
        const days = allDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dow = day.getDay();
          const sched = schedDays?.get(dow);
          const rec = recordMap.get(dateStr);
          const isDayOff = sched?.is_day_off ?? (dow === 0 || dow === 6);
          const partTime = isPartTimeSchedule(sched);
          const tolerances: Tolerances = tol || { tolerance_late_minutes: 0, tolerance_overtime_minutes: 0, tolerance_early_leave_minutes: 0 };
          const calculated = sched && !isDayOff ? calculateWorkday(rec, sched, tolerances) : null;
          const normalized = calculated?.normalized;

          let workedMinutes = 0, overtimeMinutes = 0, lateMinutes = 0;
          let status = isDayOff ? "Folga" : "Falta";

          if (calculated && normalized && (normalized.clock_in || normalized.lunch_out || normalized.lunch_in || normalized.clock_out)) {
            workedMinutes = calculated.worked;
            overtimeMinutes = Math.max(0, calculated.diff);
            lateMinutes = Math.abs(Math.min(0, calculated.diff));
            status = calculated.incomplete ? "Incompleto" : calculated.diff > 0 ? "H. Extra" : calculated.diff < 0 ? "Atrasado" : "Normal";
          }

          if (status === "Falta") absences++;
          totalWorked += workedMinutes;
          totalOvertime += overtimeMinutes;
          totalLate += lateMinutes;

          return {
            dateStr,
            dayLabel: format(day, "dd/MM EEE", { locale: pt }),
            clockIn: normalized?.clock_in ?? null,
            lunchOut: partTime ? null : (normalized?.lunch_out ?? null),
            lunchIn: partTime ? null : (normalized?.lunch_in ?? null),
            clockOut: partTime ? (normalized?.lunch_out ?? normalized?.clock_out ?? null) : (normalized?.clock_out ?? null),
            workedMinutes,
            overtimeMinutes,
            lateMinutes,
            status,
          };
        });

        result.push({
          empName: `${emp.first_name} ${emp.last_name}`,
          empPosition: emp.position,
          empDept: (emp as any).departments?.name || "—",
          days,
          totalWorked,
          totalOvertime,
          totalLate,
          absences,
        });
      }

      return result;
    } finally {
      setLoading(false);
    }
  }, [filteredEmployees, startStr, endStr, startDate, endDate]);

  const handleExcel = useCallback(async () => {
    const data = await buildData();
    const wb = new ExcelJS.Workbook();

    // Summary sheet
    const wsSummary = wb.addWorksheet("Resumo");
    wsSummary.addRow(["Relatório Mensal de Ponto", "", "", "", "", ""]);
    wsSummary.addRow([`Mês: ${MONTHS[month]} ${year}`, `Setor: ${deptName}`]);
    wsSummary.addRow([]);
    wsSummary.addRow(["Funcionário", "Cargo", "Setor", "Total Trabalhado", "Horas Extra", "Atrasos", "Faltas"]);
    data.forEach((e) => {
      wsSummary.addRow([
        e.empName, e.empPosition, e.empDept,
        minutesToHHMM(e.totalWorked), minutesToHHMM(e.totalOvertime),
        minutesToHHMM(e.totalLate), e.absences,
      ]);
    });
    [30, 20, 20, 16, 14, 14, 10].forEach((w, i) => { wsSummary.getColumn(i + 1).width = w; });

    // Detail sheet per employee
    for (const emp of data) {
      const sheetName = emp.empName.slice(0, 28).replace(/[\\/*?[\]]/g, "");
      const wsDetail = wb.addWorksheet(sheetName);
      wsDetail.addRow([emp.empName, emp.empPosition, emp.empDept]);
      wsDetail.addRow([]);
      wsDetail.addRow(["Data", "Entrada", "Saída Almoço", "Retorno Almoço", "Saída", "Total", "H. Extra", "Atraso", "Status"]);
      emp.days.forEach((d) => {
        wsDetail.addRow([
          d.dayLabel,
          formatTime(d.clockIn),
          formatTime(d.lunchOut),
          formatTime(d.lunchIn),
          formatTime(d.clockOut),
          d.workedMinutes > 0 ? minutesToHHMM(d.workedMinutes) : "—",
          d.overtimeMinutes > 0 ? minutesToHHMM(d.overtimeMinutes) : "—",
          d.lateMinutes > 0 ? minutesToHHMM(d.lateMinutes) : "—",
          d.status,
        ]);
      });
      wsDetail.addRow([]);
      wsDetail.addRow(["", "", "", "", "Totais:", minutesToHHMM(emp.totalWorked), minutesToHHMM(emp.totalOvertime), minutesToHHMM(emp.totalLate), `${emp.absences} faltas`]);
      [16, 10, 14, 16, 10, 10, 10, 10, 12].forEach((w, i) => { wsDetail.getColumn(i + 1).width = w; });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ponto_${MONTHS[month]}_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildData, month, year, deptName]);

  const handlePdf = useCallback(async () => {
    const data = await buildData();
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const rowH = 6;
    const headers = ["Data", "Entrada", "S. Almoço", "R. Almoço", "Saída", "Total", "H.Extra", "Atraso", "Status"];
    const colWidths = [28, 20, 22, 22, 20, 18, 18, 18, 22];

    // Title page / summary
    doc.setFontSize(16);
    doc.text(`Relatório Mensal de Ponto`, margin, 20);
    doc.setFontSize(11);
    doc.text(`${MONTHS[month]} ${year} — ${deptName}`, margin, 28);

    doc.setFontSize(9);
    let y = 40;
    doc.setFont("helvetica", "bold");
    ["Funcionário", "Cargo", "Setor", "Trabalhado", "H. Extra", "Atrasos", "Faltas"].forEach((h, i) => {
      const xs = [margin, margin + 55, margin + 100, margin + 145, margin + 175, margin + 200, margin + 225];
      doc.text(h, xs[i], y);
    });
    doc.setFont("helvetica", "normal");
    y += rowH;

    data.forEach((emp) => {
      if (y > pageH - 15) { doc.addPage(); y = 20; }
      const xs = [margin, margin + 55, margin + 100, margin + 145, margin + 175, margin + 200, margin + 225];
      [emp.empName, emp.empPosition, emp.empDept, minutesToHHMM(emp.totalWorked), minutesToHHMM(emp.totalOvertime), minutesToHHMM(emp.totalLate), String(emp.absences)].forEach((v, i) => {
        doc.text(v, xs[i], y);
      });
      y += rowH;
    });

    // Detail pages per employee
    for (const emp of data) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${emp.empName} — ${emp.empPosition}`, margin, 16);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${emp.empDept} | ${MONTHS[month]} ${year}`, margin, 23);

      // Header
      y = 32;
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
      doc.setFont("helvetica", "bold");
      let x = margin;
      headers.forEach((h, i) => { doc.text(h, x + 1, y); x += colWidths[i]; });
      doc.setFont("helvetica", "normal");
      y += rowH;

      emp.days.forEach((d) => {
        if (y > pageH - 15) { doc.addPage(); y = 16; }
        x = margin;
        [
          d.dayLabel,
          formatTime(d.clockIn),
          formatTime(d.lunchOut),
          formatTime(d.lunchIn),
          formatTime(d.clockOut),
          d.workedMinutes > 0 ? minutesToHHMM(d.workedMinutes) : "—",
          d.overtimeMinutes > 0 ? minutesToHHMM(d.overtimeMinutes) : "—",
          d.lateMinutes > 0 ? minutesToHHMM(d.lateMinutes) : "—",
          d.status,
        ].forEach((cell, ci) => { doc.text(cell, x + 1, y); x += colWidths[ci]; });
        y += rowH;
      });

      // Totals row
      if (y > pageH - 15) { doc.addPage(); y = 16; }
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.text("Totais:", margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 1, y);
      x = margin + colWidths.slice(0, 5).reduce((a, b) => a + b, 0);
      [minutesToHHMM(emp.totalWorked), minutesToHHMM(emp.totalOvertime), minutesToHHMM(emp.totalLate), `${emp.absences} faltas`].forEach((v, i) => {
        doc.text(v, x + 1, y);
        x += colWidths[5 + i];
      });
      doc.setFont("helvetica", "normal");
    }

    doc.save(`ponto_${MONTHS[month]}_${year}.pdf`);
  }, [buildData, month, year, deptName]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Exportar Mensal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Relatório Mensal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mês</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ano</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Setor</label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {(departments || []).map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredEmployees.length} funcionário(s) · {MONTHS[month]} {year}
          </p>

          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleExcel} disabled={loading || filteredEmployees.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {loading ? "Gerando..." : "Excel"}
            </Button>
            <Button className="flex-1" variant="secondary" onClick={handlePdf} disabled={loading || filteredEmployees.length === 0}>
              <FileText className="h-4 w-4 mr-2" />
              {loading ? "Gerando..." : "PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
