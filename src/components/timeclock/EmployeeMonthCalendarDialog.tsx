import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay } from "date-fns";
import { pt } from "date-fns/locale";
import jsPDF from "jspdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useHolidays } from "@/hooks/useHolidays";
import { evaluateDay, formatPunchTime, isPartTimeSchedule } from "@/lib/timeClock";
import { cn } from "@/lib/utils";

type DayKind = "worked" | "incomplete" | "absence" | "off" | "holiday" | "vacation" | "future";

const KIND_LABEL: Record<DayKind, string> = {
  worked: "Picado",
  incomplete: "Incompleto",
  absence: "Falta",
  off: "Folga",
  holiday: "Feriado",
  vacation: "Férias",
  future: "—",
};

const KIND_CLASS: Record<DayKind, string> = {
  worked: "bg-success/15 border-success/50 text-success",
  incomplete: "bg-warning/15 border-warning/50 text-warning",
  absence: "bg-destructive/15 border-destructive/50 text-destructive",
  off: "bg-muted border-border text-muted-foreground",
  holiday: "bg-muted border-border text-muted-foreground",
  vacation: "bg-primary/10 border-primary/40 text-primary",
  future: "bg-background border-border text-muted-foreground/60",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  employeeName: string;
  initialDate?: Date;
}

export function EmployeeMonthCalendarButton(props: Omit<Props, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
        <CalendarDays className="h-4 w-4" />
        Calendário do mês
      </Button>
      {open && <EmployeeMonthCalendarDialog {...props} open={open} onOpenChange={setOpen} />}
    </>
  );
}

export function EmployeeMonthCalendarDialog({ open, onOpenChange, employeeId, employeeName, initialDate }: Props) {
  const [ref, setRef] = useState<Date>(startOfMonth(initialDate ?? new Date()));
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  const s = format(start, "yyyy-MM-dd");
  const e = format(end, "yyyy-MM-dd");
  const { getHoliday } = useHolidays();

  const { data, isLoading } = useQuery({
    queryKey: ["employee-month-calendar", employeeId, s],
    queryFn: async () => {
      const [emp, recs, abs, vac, indiv] = await Promise.all([
        supabase.from("employees").select("first_name,last_name,position,nif,schedule_template_id,departments(name)").eq("id", employeeId).single(),
        supabase.from("time_clock_records").select("*").eq("employee_id", employeeId).gte("record_date", s).lte("record_date", e),
        supabase.from("absences").select("absence_date,type,justified").eq("employee_id", employeeId).gte("absence_date", s).lte("absence_date", e),
        supabase.from("vacation_requests").select("start_date,end_date,status").eq("employee_id", employeeId).eq("status", "approved").lte("start_date", e).gte("end_date", s),
        supabase.from("employee_schedules").select("*").eq("employee_id", employeeId),
      ]);
      let tdays: any[] = [];
      if (emp.data?.schedule_template_id) {
        const r = await supabase.from("schedule_template_days").select("*").eq("template_id", emp.data.schedule_template_id);
        tdays = r.data || [];
      }
      return { emp: emp.data as any, recs: recs.data || [], abs: abs.data || [], vac: vac.data || [], indiv: indiv.data || [], tdays };
    },
    enabled: open,
  });

  const days = useMemo(() => {
    if (!data) return [];
    const today = format(new Date(), "yyyy-MM-dd");
    const recMap = new Map(data.recs.map((r: any) => [r.record_date, r]));
    const absSet = new Set(data.abs.map((a: any) => a.absence_date));
    return eachDayOfInterval({ start, end }).map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const dow = getDay(d);
      const sched = data.indiv.find((x: any) => x.day_of_week === dow) ?? data.tdays.find((x: any) => x.day_of_week === dow);
      const rec: any = recMap.get(ds);
      const hasPunch = !!(rec && (rec.clock_in || rec.lunch_out || rec.lunch_in || rec.clock_out));
      const partTime = isPartTimeSchedule(sched);
      // Mesmo critério do motor de ponto (meio período com 2 picagens conta como completo).
      const complete = !!rec && (sched && !sched.is_day_off
        ? !evaluateDay(rec, sched).incomplete
        : !!(rec.clock_in && (rec.clock_out || rec.lunch_out)));
      const isOff = sched ? sched.is_day_off : dow === 0 || dow === 6;
      const holiday = getHoliday(ds);
      const onVac = data.vac.some((v: any) => ds >= v.start_date && ds <= v.end_date);
      let kind: DayKind;
      if (hasPunch) kind = complete ? "worked" : "incomplete";
      else if (onVac) kind = "vacation";
      else if (holiday) kind = "holiday";
      else if (isOff) kind = "off";
      else if (ds > today) kind = "future";
      else if (absSet.has(ds) || ds < today) kind = "absence";
      else kind = "future";
      return {
        date: d, ds, kind, holidayName: holiday?.name,
        clockIn: rec?.clock_in ?? null,
        lunchOut: partTime ? null : rec?.lunch_out ?? null,
        lunchIn: partTime ? null : rec?.lunch_in ?? null,
        clockOut: partTime ? rec?.lunch_out ?? rec?.clock_out ?? null : rec?.clock_out ?? null,
        notes: rec?.notes ?? "",
      };
    });
  }, [data, s]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Partial<Record<DayKind, number>> = {};
    days.forEach((d) => (c[d.kind] = (c[d.kind] ?? 0) + 1));
    return c;
  }, [days]);

  const leading = (getDay(start) + 6) % 7; // semana começa à segunda
  const monthLabel = format(ref, "MMMM yyyy", { locale: pt });

  const printPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const m = 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Folha Mensal de Picagens", m, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Colaborador: ${employeeName}`, m, 24);
    doc.text(`Cargo: ${data?.emp?.position ?? "—"}   Setor: ${data?.emp?.departments?.name ?? "—"}${data?.emp?.nif ? `   NIF: ${data.emp.nif}` : ""}`, m, 30);
    doc.text(`Mês: ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`, m, 36);

    const headers = ["Data", "Entrada", "S. Almoço", "R. Almoço", "Saída", "Estado", "Observações"];
    const cw = [26, 20, 22, 22, 20, 26, W - 2 * m - 136];
    const rh = 6.2;
    let y = 44;
    const drawHeader = () => {
      doc.setFillColor(235, 235, 235);
      doc.rect(m, y - 4.3, W - 2 * m, rh, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      let x = m;
      headers.forEach((h, i) => { doc.text(h, x + 1, y); x += cw[i]; });
      doc.setFont("helvetica", "normal");
      y += rh;
    };
    drawHeader();
    days.forEach((d) => {
      if (y > H - 45) { doc.addPage(); y = 16; drawHeader(); }
      if (d.kind === "off" || d.kind === "holiday") {
        doc.setFillColor(246, 246, 246);
        doc.rect(m, y - 4.3, W - 2 * m, rh, "F");
      }
      let x = m;
      const status = d.kind === "holiday" && d.holidayName ? `Feriado` : KIND_LABEL[d.kind];
      const note = (d.kind === "holiday" ? d.holidayName ?? "" : d.notes || "").slice(0, 40);
      [format(d.date, "dd/MM EEE", { locale: pt }), formatPunchTime(d.clockIn), formatPunchTime(d.lunchOut), formatPunchTime(d.lunchIn), formatPunchTime(d.clockOut), status, note]
        .forEach((v, i) => { doc.text(String(v), x + 1, y); x += cw[i]; });
      doc.setDrawColor(225, 225, 225);
      doc.line(m, y + 1.9, W - m, y + 1.9);
      y += rh;
    });

    y += 4;
    doc.setFontSize(9);
    doc.text(
      `Resumo: ${counts.worked ?? 0} picados · ${counts.incomplete ?? 0} incompletos · ${counts.absence ?? 0} faltas · ${counts.vacation ?? 0} férias · ${(counts.off ?? 0) + (counts.holiday ?? 0)} folgas/feriados`,
      m, y,
    );
    if (y > H - 35) { doc.addPage(); y = 20; }
    const sy = H - 25;
    doc.setFontSize(8.5);
    doc.text("Declaro que as picagens acima correspondem aos meus registos de assiduidade.", m, sy - 12);
    doc.line(m, sy, m + 75, sy);
    doc.line(W - m - 75, sy, W - m, sy);
    doc.text("Assinatura do colaborador", m, sy + 5);
    doc.text("Assinatura do responsável", W - m - 75, sy + 5);
    doc.text("Data: ____/____/________", m, sy + 12);

    doc.save(`picagens_${employeeName.replace(/\s+/g, "_")}_${format(ref, "yyyy-MM")}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Calendário de picagens · {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setRef(subMonths(ref, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-medium capitalize">{monthLabel}</p>
          <Button variant="ghost" size="icon" aria-label="Mês seguinte" onClick={() => setRef(addMonths(ref, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
                <div key={w} className="text-xs font-medium text-muted-foreground">{w}</div>
              ))}
              {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
              {days.map((d) => (
                <div
                  key={d.ds}
                  title={`${format(d.date, "dd/MM")} · ${d.holidayName ?? KIND_LABEL[d.kind]}`}
                  className={cn("rounded-md border p-1.5 min-h-[62px] flex flex-col items-center gap-0.5", KIND_CLASS[d.kind])}
                >
                  <span className="text-sm font-semibold">{format(d.date, "d")}</span>
                  {d.clockIn || d.clockOut ? (
                    <span className="text-[10px] leading-tight text-foreground/80">
                      {formatPunchTime(d.clockIn)}<br />{formatPunchTime(d.clockOut)}
                    </span>
                  ) : (
                    <span className="text-[10px]">{d.kind !== "future" ? KIND_LABEL[d.kind] : ""}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {(["worked", "incomplete", "absence", "vacation", "off", "holiday"] as DayKind[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("h-3 w-3 rounded-sm border", KIND_CLASS[k])} />
                  {KIND_LABEL[k]} ({counts[k] ?? 0})
                </span>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={printPdf} disabled={!data} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Folha para assinatura (PDF)
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
