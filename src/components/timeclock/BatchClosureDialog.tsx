import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { minutesToHHMM } from "@/lib/timeClock";
import { computeMonthlyClosure, type MovementLike } from "@/lib/timeBank";
import {
  computeMonthlyNegativeDiff, computePendingAttendanceDebit,
  type AttendanceDay,
} from "@/lib/attendanceReconciliation";
import { Layers, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type PreviewRow = {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number; // 1..12
  opening: number;
  credits: number;
  debits: number;
  attendanceDebit: number;
  closingBalance: number;
  alreadyClosed: boolean;
  pendingCount: number;
  error?: string;
};

type ExecResult = {
  employeeName: string;
  year: number;
  month: number;
  status: "success" | "skipped" | "failed";
  message?: string;
};

const monthKey = (y: number, m: number) => y * 12 + (m - 1);
const firstDayOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
const lastDayOf = (y: number, m: number) => format(new Date(y, m, 0), "yyyy-MM-dd");
const monthOfDate = (iso: string) => {
  const [y, m] = iso.split("-").map((s) => parseInt(s, 10));
  return { year: y, month: m };
};
const addMonth = (y: number, m: number, delta: number) => {
  const idx = monthKey(y, m) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};

export function BatchClosureDialog() {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExecResult[] | null>(null);
  const [forcePending, setForcePending] = useState(false);
  const [ackForce, setAckForce] = useState(false);

  // current month (don't close it)
  const now = new Date();
  const lastClosableIdx = monthKey(now.getFullYear(), now.getMonth() + 1) - 1;

  // ---- Data ----
  const { data: employees } = useQuery({
    enabled: open,
    queryKey: ["batch-closure-employees"],
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

  const empIds = useMemo(() => (employees || []).map((e) => e.id), [employees]);

  const { data: allMovements } = useQuery({
    enabled: open && empIds.length > 0,
    queryKey: ["batch-closure-movements", empIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_movements")
        .select("employee_id, record_date, source_type, movement_type, minutes, effective_minutes, decision, status")
        .in("employee_id", empIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allRecords } = useQuery({
    enabled: open && empIds.length > 0,
    queryKey: ["batch-closure-records", empIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("employee_id, record_date, clock_in, lunch_out, lunch_in, clock_out")
        .in("employee_id", empIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allClosures } = useQuery({
    enabled: open && empIds.length > 0,
    queryKey: ["batch-closure-existing", empIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_monthly_closures")
        .select("employee_id, period_year, period_month, is_locked, carried_over_minutes")
        .in("employee_id", empIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allPending } = useQuery({
    enabled: open && empIds.length > 0,
    queryKey: ["batch-closure-pending", empIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("overtime_approvals")
        .select("employee_id, record_date")
        .eq("status", "pending")
        .in("employee_id", empIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allEmpSchedules } = useQuery({
    enabled: open && empIds.length > 0,
    queryKey: ["batch-closure-emp-schedules", empIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_schedules").select("*").in("employee_id", empIds);
      if (error) throw error;
      return data || [];
    },
  });

  const templateIds = useMemo(
    () => Array.from(new Set((employees || []).map((e) => e.schedule_template_id).filter(Boolean))) as string[],
    [employees],
  );

  const { data: allTemplateDays } = useQuery({
    enabled: open && templateIds.length > 0,
    queryKey: ["batch-closure-template-days", templateIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template_days").select("*").in("template_id", templateIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allTemplates } = useQuery({
    enabled: open && templateIds.length > 0,
    queryKey: ["batch-closure-templates", templateIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("id, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes")
        .in("id", templateIds);
      if (error) throw error;
      return data || [];
    },
  });

  const dataReady =
    !!employees && !!allMovements && !!allRecords && !!allClosures && !!allEmpSchedules && !!allPending;

  // ---- Preview computation ----
  const preview = useMemo<PreviewRow[]>(() => {
    if (!dataReady || !employees) return [];

    const movByEmp = new Map<string, any[]>();
    for (const m of allMovements!) {
      const arr = movByEmp.get(m.employee_id) || [];
      arr.push(m);
      movByEmp.set(m.employee_id, arr);
    }
    const recByEmp = new Map<string, any[]>();
    for (const r of allRecords!) {
      const arr = recByEmp.get(r.employee_id) || [];
      arr.push(r);
      recByEmp.set(r.employee_id, arr);
    }
    const closuresByEmp = new Map<string, Map<number, { is_locked: boolean; carried_over_minutes: number }>>();
    for (const c of allClosures!) {
      let inner = closuresByEmp.get(c.employee_id);
      if (!inner) { inner = new Map(); closuresByEmp.set(c.employee_id, inner); }
      inner.set(monthKey(c.period_year, c.period_month), {
        is_locked: !!c.is_locked, carried_over_minutes: c.carried_over_minutes ?? 0,
      });
    }
    const empSchedByEmp = new Map<string, Map<number, any>>();
    for (const s of allEmpSchedules!) {
      let inner = empSchedByEmp.get(s.employee_id);
      if (!inner) { inner = new Map(); empSchedByEmp.set(s.employee_id, inner); }
      inner.set(s.day_of_week, s);
    }
    const tplDaysByTpl = new Map<string, Map<number, any>>();
    for (const d of (allTemplateDays || [])) {
      let inner = tplDaysByTpl.get(d.template_id);
      if (!inner) { inner = new Map(); tplDaysByTpl.set(d.template_id, inner); }
      inner.set(d.day_of_week, d);
    }
    const tolByTpl = new Map<string, any>();
    for (const t of (allTemplates || [])) tolByTpl.set(t.id, t);

    // Pending counts by employee+monthKey
    const pendingMap = new Map<string, number>();
    for (const p of (allPending || [])) {
      const { year: py, month: pm } = monthOfDate(p.record_date as string);
      const k = `${p.employee_id}:${monthKey(py, pm)}`;
      pendingMap.set(k, (pendingMap.get(k) || 0) + 1);
    }

    const rows: PreviewRow[] = [];

    for (const emp of employees) {
      const movs = movByEmp.get(emp.id) || [];
      const recs = recByEmp.get(emp.id) || [];
      if (movs.length === 0 && recs.length === 0) continue;

      const dates = [
        ...movs.map((m) => m.record_date as string),
        ...recs.map((r) => r.record_date as string),
      ];
      const earliestIso = dates.reduce((a, b) => (a < b ? a : b));
      const { year: sY, month: sM } = monthOfDate(earliestIso);
      const startIdx = monthKey(sY, sM);
      if (startIdx > lastClosableIdx) continue;

      const empClosures = closuresByEmp.get(emp.id) || new Map();
      const indivMap = empSchedByEmp.get(emp.id) || new Map();
      const tplMap = emp.schedule_template_id ? (tplDaysByTpl.get(emp.schedule_template_id) || new Map()) : new Map();
      const tol = emp.schedule_template_id ? (tolByTpl.get(emp.schedule_template_id) || null) : null;

      let runningOpening = 0;
      // Pull opening from a locked closure just before start, if any
      const prevClosure = empClosures.get(startIdx - 1);
      if (prevClosure?.is_locked) runningOpening = prevClosure.carried_over_minutes;

      for (let idx = startIdx; idx <= lastClosableIdx; idx++) {
        const y = Math.floor(idx / 12);
        const m = (idx % 12) + 1;
        const existing = empClosures.get(idx);

        if (existing?.is_locked) {
          runningOpening = existing.carried_over_minutes;
          continue; // skip — already closed
        }

        const first = firstDayOf(y, m);
        const last = lastDayOf(y, m);

        const monthMovs: MovementLike[] = movs
          .filter((mv) => mv.record_date >= first && mv.record_date <= last)
          .map((mv) => ({
            source_type: mv.source_type, movement_type: mv.movement_type,
            minutes: mv.minutes, effective_minutes: mv.effective_minutes,
            decision: mv.decision, status: mv.status,
          }));

        // Attendance debit
        const recordByDate = new Map<string, any>();
        for (const r of recs) {
          if (r.record_date >= first && r.record_date <= last) recordByDate.set(r.record_date, r);
        }
        const lastDayNum = new Date(y, m, 0).getDate();
        const days: AttendanceDay[] = [];
        for (let d = 1; d <= lastDayNum; d++) {
          const date = new Date(y, m - 1, d);
          const iso = format(date, "yyyy-MM-dd");
          const dow = date.getDay();
          const sched = indivMap.get(dow) || tplMap.get(dow) || null;
          days.push({ schedule: sched, record: recordByDate.get(iso) || null, tolerances: tol });
        }
        const negative = computeMonthlyNegativeDiff(days);
        const alreadyAdjusted = monthMovs
          .filter((mv) => mv.source_type === "monthly_attendance_adjustment" && mv.status !== "cancelled")
          .reduce((a, mv) => a + (mv.minutes || 0), 0);
        const pendingDebit = computePendingAttendanceDebit(negative, alreadyAdjusted);

        try {
          const res = computeMonthlyClosure({
            opening: runningOpening,
            movementsInMonth: monthMovs,
            decision: "carry_over_all",
            paidMinutes: 0,
            notes: "Fecho em lote — regularização",
            previousMonthClosed: true, // safe: we only get here in order after locked or computed
            hasPriorMovements: idx > startIdx,
            attendanceDebitMinutes: pendingDebit,
          });
          const pendingCount = pendingMap.get(`${emp.id}:${idx}`) || 0;
          rows.push({
            employeeId: emp.id,
            employeeName: `${emp.first_name} ${emp.last_name}`,
            year: y, month: m,
            opening: runningOpening,
            credits: res.approvedCredits,
            debits: res.approvedDebits,
            attendanceDebit: pendingDebit,
            closingBalance: res.closingBalance,
            alreadyClosed: false,
            pendingCount,
          });
          runningOpening = res.closingBalance;
        } catch (e: any) {
          rows.push({
            employeeId: emp.id,
            employeeName: `${emp.first_name} ${emp.last_name}`,
            year: y, month: m,
            opening: runningOpening, credits: 0, debits: 0,
            attendanceDebit: pendingDebit, closingBalance: runningOpening,
            alreadyClosed: false,
            pendingCount: pendingMap.get(`${emp.id}:${idx}`) || 0,
            error: e.message,
          });
          break; // stop this employee's chain
        }
      }
    }
    return rows;
  }, [dataReady, employees, allMovements, allRecords, allClosures, allEmpSchedules, allTemplateDays, allTemplates, allPending, lastClosableIdx]);

  // ---- Execution ----
  const computeAttendanceDebitForExec = (
    empId: string,
    y: number, m: number,
  ): number => {
    if (!employees || !allRecords || !allMovements || !allEmpSchedules) return 0;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return 0;
    const first = firstDayOf(y, m);
    const last = lastDayOf(y, m);
    const indivMap = new Map<number, any>();
    for (const s of allEmpSchedules) if (s.employee_id === empId) indivMap.set(s.day_of_week, s);
    const tplMap = new Map<number, any>();
    if (emp.schedule_template_id) {
      for (const d of (allTemplateDays || [])) {
        if (d.template_id === emp.schedule_template_id) tplMap.set(d.day_of_week, d);
      }
    }
    const tol = emp.schedule_template_id
      ? (allTemplates || []).find((t) => t.id === emp.schedule_template_id) || null
      : null;
    const recordByDate = new Map<string, any>();
    for (const r of allRecords) {
      if (r.employee_id === empId && r.record_date >= first && r.record_date <= last) {
        recordByDate.set(r.record_date, r);
      }
    }
    const lastDayNum = new Date(y, m, 0).getDate();
    const days: AttendanceDay[] = [];
    for (let d = 1; d <= lastDayNum; d++) {
      const date = new Date(y, m - 1, d);
      const iso = format(date, "yyyy-MM-dd");
      const dow = date.getDay();
      const sched = indivMap.get(dow) || tplMap.get(dow) || null;
      days.push({ schedule: sched, record: recordByDate.get(iso) || null, tolerances: tol });
    }
    const negative = computeMonthlyNegativeDiff(days);
    const alreadyAdjusted = allMovements
      .filter((mv) =>
        mv.employee_id === empId &&
        mv.record_date >= first && mv.record_date <= last &&
        mv.source_type === "monthly_attendance_adjustment" &&
        mv.status !== "cancelled",
      )
      .reduce((a: number, mv: any) => a + (mv.minutes || 0), 0);
    return computePendingAttendanceDebit(negative, alreadyAdjusted);
  };

  const executeBatch = async () => {
    if (!preview.length) return;
    setRunning(true);
    const out: ExecResult[] = [];

    // Group by employee, in order
    const byEmp = new Map<string, PreviewRow[]>();
    const rowsToRun = preview.filter((r) => !r.error && (r.pendingCount === 0 || forcePending));
    for (const row of rowsToRun) {
      const arr = byEmp.get(row.employeeId) || [];
      arr.push(row);
      byEmp.set(row.employeeId, arr);
    }
    for (const [, rows] of byEmp) {
      rows.sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month));
    }

    for (const [empId, rows] of byEmp) {
      for (const row of rows) {
        const attendanceDebit = computeAttendanceDebitForExec(empId, row.year, row.month);
        const { error } = await supabase.rpc("close_time_bank_month", {
          _employee_id: empId,
          _year: row.year,
          _month: row.month,
          _decision: "carry_over_all",
          _paid_minutes: 0,
          _notes: "Fecho em lote — regularização",
          _attendance_debit_minutes: attendanceDebit,
          _force: row.pendingCount > 0 && forcePending,
        });
        if (error) {
          const msg = error.message || String(error);
          if (/já fechado/i.test(msg)) {
            out.push({ employeeName: row.employeeName, year: row.year, month: row.month, status: "skipped", message: msg });
            continue;
          }
          if (/candidato\(s\) de aprovação pendente/i.test(msg)) {
            out.push({ employeeName: row.employeeName, year: row.year, month: row.month, status: "skipped", message: "Bloqueado por pendentes" });
            break;
          }
          out.push({ employeeName: row.employeeName, year: row.year, month: row.month, status: "failed", message: msg });
          break; // stop chain for this employee
        } else {
          out.push({ employeeName: row.employeeName, year: row.year, month: row.month, status: "success" });
        }
      }
    }

    setResults(out);
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
    qc.invalidateQueries({ queryKey: ["closure-movements"] });
    qc.invalidateQueries({ queryKey: ["closure-existing"] });
    qc.invalidateQueries({ queryKey: ["closure-attendance-adj"] });
    qc.invalidateQueries({ queryKey: ["batch-closure-existing"] });
    qc.invalidateQueries({ queryKey: ["batch-closure-movements"] });

    const ok = out.filter((r) => r.status === "success").length;
    const failed = out.filter((r) => r.status === "failed").length;
    toast({
      title: "Fecho em lote concluído",
      description: `${ok} fechado(s), ${failed} falha(s).`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  if (!isAdmin) return null;

  const cleanRows = preview.filter((r) => !r.error && r.pendingCount === 0);
  const pendingRows = preview.filter((r) => !r.error && r.pendingCount > 0);
  const pendingCandidatesTotal = pendingRows.reduce((a, r) => a + r.pendingCount, 0);
  const totalToClose = forcePending ? cleanRows.length + pendingRows.length : cleanRows.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResults(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="h-4 w-4" /> Regularizar meses em atraso (lote)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Fecho em lote — meses em atraso</DialogTitle>
          <DialogDescription>
            Pré-visualiza, em ordem cronológica e por colaborador, todos os meses
            por fechar até ao mês anterior ao atual. Decisão fixa:
            <strong> transitar tudo</strong>. Conciliação do ponto ativada.
            Nada é gravado até confirmar.
          </DialogDescription>
        </DialogHeader>

        {!dataReady ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar dados…
          </div>
        ) : results ? (
          <ResultsView results={results} />
        ) : preview.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Não há meses em atraso para fechar. Tudo em dia.
          </p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {totalToClose} mês(es) a fechar para {new Set(preview.map((r) => r.employeeId)).size} colaborador(es).
            </div>
            <ScrollArea className="h-[420px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Abertura</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead className="text-right">Débitos</TableHead>
                    <TableHead className="text-right">Conciliação</TableHead>
                    <TableHead className="text-right">Transita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r, i) => (
                    <TableRow key={i} className={r.error ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{r.employeeName}</TableCell>
                      <TableCell>{String(r.month).padStart(2, "0")}/{r.year}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{minutesToHHMM(r.opening)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-primary">{minutesToHHMM(r.credits)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">{minutesToHHMM(-r.debits)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">
                        {r.attendanceDebit > 0 ? minutesToHHMM(-r.attendanceDebit) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {r.error
                          ? <span className="text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{r.error}</span>
                          : minutesToHHMM(r.closingBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>Cancelar</Button>
              <Button
                onClick={executeBatch}
                disabled={running || totalToClose === 0 || !dataReady}
              >
                {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A fechar…</> : `Confirmar e fechar (${totalToClose})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsView({ results }: { results: ExecResult[] }) {
  const ok = results.filter((r) => r.status === "success");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "failed");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />{ok.length} fechados</Badge>
        <Badge variant="secondary" className="gap-1">{skipped.length} pulados</Badge>
        <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{failed.length} falhas</Badge>
      </div>
      <ScrollArea className="h-[360px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.employeeName}</TableCell>
                <TableCell>{String(r.month).padStart(2, "0")}/{r.year}</TableCell>
                <TableCell>
                  {r.status === "success" && <Badge variant="default">OK</Badge>}
                  {r.status === "skipped" && <Badge variant="secondary">Pulado</Badge>}
                  {r.status === "failed" && <Badge variant="destructive">Falhou</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.message || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}