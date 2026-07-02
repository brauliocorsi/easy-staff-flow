import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { minutesToHHMM } from "@/lib/timeClock";
import {
  computeMonthlyClosure, closureDecisionLabel,
  type ClosureDecision, type MovementLike,
} from "@/lib/timeBank";
import {
  computeMonthlyNegativeDiff, computePendingAttendanceDebit,
  type AttendanceDay,
} from "@/lib/attendanceReconciliation";
import { Lock, Unlock, AlertTriangle, FileWarning } from "lucide-react";
import { BatchClosureDialog } from "./BatchClosureDialog";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type Props = { employeeId?: string };

export function MonthlyClosureTab({ employeeId }: Props) {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12
  const [empId, setEmpId] = useState<string | undefined>(employeeId);
  const [decision, setDecision] = useState<ClosureDecision>("carry_over_all");
  const [paidHours, setPaidHours] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [confirmReconciliation, setConfirmReconciliation] = useState(true);
  // Regularização inicial
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotCutoff, setSnapshotCutoff] = useState<string>("");
  const [snapshotHours, setSnapshotHours] = useState<string>("");
  const [snapshotNotes, setSnapshotNotes] = useState<string>("");
  // Zerar saldo (sem pagar)
  const [zeroOpen, setZeroOpen] = useState(false);
  const [zeroNotes, setZeroNotes] = useState<string>("");
  // Forçar fecho apesar de candidatos pendentes
  const [forcePending, setForcePending] = useState(false);
  const [ackForce, setAckForce] = useState(false);

  const effectiveEmp = employeeId ?? empId;

  const { data: employees } = useQuery({
    enabled: !employeeId,
    queryKey: ["closure-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees").select("id, first_name, last_name").eq("status", "active").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = format(new Date(year, month, 0), "yyyy-MM-dd");
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  const { data: movements } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-movements", effectiveEmp, firstDay, lastDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_movements")
        .select("source_type, movement_type, minutes, effective_minutes, decision, status")
        .eq("employee_id", effectiveEmp!)
        .gte("record_date", firstDay).lte("record_date", lastDay);
      if (error) throw error;
      return (data || []) as MovementLike[];
    },
  });

  const { data: prevClosure } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-prev", effectiveEmp, prevYear, prevMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_monthly_closures")
        .select("carried_over_minutes")
        .eq("employee_id", effectiveEmp!)
        .eq("period_year", prevYear).eq("period_month", prevMonth)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Detecta se existem movimentos anteriores ao 1º dia deste mês.
  // Se houver e o mês anterior não estiver fechado, o fecho deve ser bloqueado.
  const { data: priorMovementsCount } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-prior-mov", effectiveEmp, firstDay],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_bank_movements")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", effectiveEmp!)
        .lt("record_date", firstDay);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: existing, refetch: refetchExisting } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-existing", effectiveEmp, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_monthly_closures")
        .select("*")
        .eq("employee_id", effectiveEmp!)
        .eq("period_year", year).eq("period_month", month)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // --- Conciliação do ponto ---
  // Carrega registos de ponto, horários (override + template) e tolerâncias do funcionário
  // para calcular o diff negativo agregado do mês.
  const { data: employeeMeta } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-employee-meta", effectiveEmp],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees").select("schedule_template_id").eq("id", effectiveEmp!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: templateDays } = useQuery({
    enabled: !!employeeMeta?.schedule_template_id,
    queryKey: ["closure-template-days", employeeMeta?.schedule_template_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template_days").select("*").eq("template_id", employeeMeta!.schedule_template_id!);
      if (error) throw error;
      return data;
    },
  });

  const { data: templateTol } = useQuery({
    enabled: !!employeeMeta?.schedule_template_id,
    queryKey: ["closure-template-tol", employeeMeta?.schedule_template_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes")
        .eq("id", employeeMeta!.schedule_template_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: employeeScheduleRows } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-employee-schedules", effectiveEmp],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_schedules").select("*").eq("employee_id", effectiveEmp!);
      if (error) throw error;
      return data;
    },
  });

  const { data: monthRecords } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-month-records", effectiveEmp, firstDay, lastDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_records")
        .select("record_date, clock_in, lunch_out, lunch_in, clock_out")
        .eq("employee_id", effectiveEmp!)
        .gte("record_date", firstDay).lte("record_date", lastDay);
      if (error) throw error;
      return data || [];
    },
  });

  // Férias aprovadas que intersetam o mês — dias dentro destes períodos
  // são IGNORADOS na conciliação (não geram débito por ausência).
  const { data: monthVacations } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-month-vacations", effectiveEmp, firstDay, lastDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("start_date, end_date")
        .eq("employee_id", effectiveEmp!)
        .eq("status", "approved")
        .lte("start_date", lastDay).gte("end_date", firstDay);
      if (error) throw error;
      return data || [];
    },
  });

  // Ausências justificadas no mês — também ignoradas.
  const { data: monthAbsences } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-month-absences", effectiveEmp, firstDay, lastDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("absence_date, justified")
        .eq("employee_id", effectiveEmp!)
        .eq("justified", true)
        .gte("absence_date", firstDay).lte("absence_date", lastDay);
      if (error) throw error;
      return data || [];
    },
  });

  // Pendentes positivos no mês (informativo)
  const { data: pendingPositives } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-pending-pos", effectiveEmp, firstDay, lastDay],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("overtime_approvals")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", effectiveEmp!)
        .eq("status", "pending")
        .gte("record_date", firstDay).lte("record_date", lastDay);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Débito de conciliação já lançado para este mês
  const { data: existingAttendanceAdjustment } = useQuery({
    enabled: !!effectiveEmp,
    queryKey: ["closure-attendance-adj", effectiveEmp, firstDay, lastDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_movements")
        .select("minutes, status")
        .eq("employee_id", effectiveEmp!)
        .eq("source_type", "monthly_attendance_adjustment")
        .neq("status", "cancelled")
        .gte("record_date", firstDay).lte("record_date", lastDay);
      if (error) throw error;
      return data || [];
    },
  });

  const attendanceTotals = useMemo(() => {
    if (!monthRecords) return { negative: 0, pendingDebit: 0, alreadyAdjusted: 0 };
    // Build day-by-day matrix for the month
    const recordByDate = new Map<string, any>();
    for (const r of monthRecords) recordByDate.set(r.record_date as string, r);

    // Schedule resolver: employee_schedules override > template
    const indivMap = new Map<number, any>();
    (employeeScheduleRows || []).forEach((s: any) => indivMap.set(s.day_of_week, s));
    const templateMap = new Map<number, any>();
    (templateDays || []).forEach((s: any) => templateMap.set(s.day_of_week, s));

    // Conjunto de datas ISO a ignorar (férias aprovadas + ausências justificadas).
    const skipSet = new Set<string>();
    for (const v of monthVacations || []) {
      const s = new Date(v.start_date as string + "T12:00:00Z");
      const e = new Date(v.end_date as string + "T12:00:00Z");
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        skipSet.add(d.toISOString().slice(0, 10));
      }
    }
    for (const a of monthAbsences || []) skipSet.add(a.absence_date as string);

    const days: AttendanceDay[] = [];
    const lastDayNum = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDayNum; d++) {
      const date = new Date(year, month - 1, d);
      const iso = format(date, "yyyy-MM-dd");
      const dow = date.getDay();
      const sched = indivMap.get(dow) || templateMap.get(dow) || null;
      const rec = recordByDate.get(iso) || null;
      days.push({
        schedule: sched,
        record: rec,
        tolerances: templateTol ?? null,
        skip: skipSet.has(iso),
      });
    }
    const negative = computeMonthlyNegativeDiff(days);
    const alreadyAdjusted = (existingAttendanceAdjustment || []).reduce(
      (a: number, m: any) => a + (m.minutes || 0), 0,
    );
    const pendingDebit = computePendingAttendanceDebit(negative, alreadyAdjusted);
    return { negative, pendingDebit, alreadyAdjusted };
  }, [monthRecords, employeeScheduleRows, templateDays, templateTol, existingAttendanceAdjustment, monthVacations, monthAbsences, year, month]);

  const opening = prevClosure?.carried_over_minutes ?? 0;
  const previousMonthClosed = !!prevClosure;
  const hasPriorMovements = (priorMovementsCount ?? 0) > 0;
  const blockedByMissingPrev = hasPriorMovements && !previousMonthClosed;
  const paidMinutes = decision === "pay_partial" || decision === "manual_adjustment"
    ? Math.round((parseFloat(paidHours || "0") || 0) * 60) : undefined;

  const attendanceDebitToApply = confirmReconciliation ? attendanceTotals.pendingDebit : 0;

  const preview = useMemo(() => {
    if (!movements) return null;
    try {
      return computeMonthlyClosure({
        opening, movementsInMonth: movements, decision, paidMinutes, notes,
        previousMonthClosed, hasPriorMovements,
        attendanceDebitMinutes: attendanceDebitToApply,
      });
    } catch (e: any) {
      return { error: e.message as string };
    }
  }, [movements, opening, decision, paidMinutes, notes, previousMonthClosed, hasPriorMovements, attendanceDebitToApply]);

  const closeMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("close_time_bank_month", {
        _employee_id: effectiveEmp!,
        _year: year, _month: month,
        _decision: decision,
        _paid_minutes: paidMinutes ?? 0,
        _notes: notes || null,
        _attendance_debit_minutes: attendanceDebitToApply,
        _force: forcePending,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Mês fechado", description: "Fecho registado com sucesso." });
      qc.invalidateQueries({ queryKey: ["closure-existing"] });
      qc.invalidateQueries({ queryKey: ["closure-movements"] });
      qc.invalidateQueries({ queryKey: ["closure-attendance-adj"] });
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
      setNotes(""); setPaidHours("");
      setForcePending(false); setAckForce(false);
    },
    onError: (e: any) => toast({ title: "Erro ao fechar", description: e.message, variant: "destructive" }),
  });

  const reopenMut = useMutation({
    mutationFn: async (closureId: string) => {
      const { error } = await supabase.rpc("reopen_time_bank_month", { _closure_id: closureId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mês reaberto" });
      refetchExisting();
      qc.invalidateQueries({ queryKey: ["closure-attendance-adj"] });
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
    },
    onError: (e: any) => toast({ title: "Erro ao reabrir", description: e.message, variant: "destructive" }),
  });

  const snapshotMut = useMutation({
    mutationFn: async () => {
      const minutes = Math.round((parseFloat(snapshotHours || "0") || 0) * 60);
      const { data, error } = await supabase.rpc("create_opening_balance_snapshot", {
        _employee_id: effectiveEmp!,
        _cutoff_date: snapshotCutoff,
        _minutes: minutes,
        _notes: snapshotNotes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Regularização criada", description: "Movimento inicial registado no banco." });
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
      qc.invalidateQueries({ queryKey: ["closure-movements"] });
      qc.invalidateQueries({ queryKey: ["closure-prior-mov"] });
      setSnapshotOpen(false);
      setSnapshotCutoff(""); setSnapshotHours(""); setSnapshotNotes("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closed = !!existing?.is_locked;

  const balanceBeforeClosure =
    preview && !("error" in preview) ? preview.balanceBeforeClosure : 0;

  const zeroOutMut = useMutation({
    mutationFn: async () => {
      if (!effectiveEmp) throw new Error("Sem funcionário");
      if (!zeroNotes.trim()) throw new Error("Motivo obrigatório");
      const adjust = -balanceBeforeClosure; // sinal oposto ao saldo
      if (adjust !== 0) {
        const movement_type = adjust > 0 ? "credit" : "debit";
        const magnitude = Math.abs(adjust);
        const effective_minutes = adjust; // já com sinal
        const { error: insErr } = await supabase.from("time_bank_movements").insert({
          employee_id: effectiveEmp,
          record_date: lastDay,
          source_type: "manual_zero_adjustment",
          movement_type,
          minutes: magnitude,
          effective_minutes,
          decision: adjust > 0 ? "credit_to_bank" : "use_bank_hours",
          status: "approved",
          description: `Zerar saldo no fecho de ${String(month).padStart(2,"0")}/${year} — ${zeroNotes.trim()}`,
        });
        if (insErr) throw insErr;
      }
      const { data, error } = await supabase.rpc("close_time_bank_month", {
        _employee_id: effectiveEmp,
        _year: year, _month: month,
        _decision: "carry_over_all",
        _paid_minutes: 0,
        _notes: `[Saldo zerado] ${zeroNotes.trim()}`,
        _attendance_debit_minutes: attendanceDebitToApply,
        _force: forcePending,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Banco zerado", description: "O saldo foi anulado e o mês fechado." });
      qc.invalidateQueries({ queryKey: ["closure-existing"] });
      qc.invalidateQueries({ queryKey: ["closure-movements"] });
      qc.invalidateQueries({ queryKey: ["closure-attendance-adj"] });
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
      setZeroOpen(false);
      setZeroNotes("");
    },
    onError: (e: any) => toast({ title: "Erro ao zerar", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {closed ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          Fecho Mensal do Banco de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && !employeeId && (
          <div className="flex justify-end">
            <BatchClosureDialog />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {!employeeId && (
            <div className="min-w-[220px]">
              <Label className="text-xs">Funcionário</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger><SelectValue placeholder="Escolher funcionário" /></SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value || String(now.getFullYear())))} className="w-[100px]" />
          </div>
        </div>

        {!effectiveEmp ? (
          <p className="text-sm text-muted-foreground">Seleciona um funcionário para começar.</p>
        ) : (
          <>
            {blockedByMissingPrev && !closed && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Mês anterior ({MONTHS[prevMonth - 1]}/{prevYear}) ainda não está fechado.
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Existem movimentos do banco de horas anteriores a este mês. Feche o mês anterior
                    antes de fechar este — caso contrário o saldo transitado seria assumido como 0
                    e o histórico ficaria incorreto.
                  </p>
                </div>
              </div>
            )}
            {existing && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={closed ? "default" : "secondary"}>{closed ? "Fechado" : "Reaberto"}</Badge>
                  <span className="text-muted-foreground">
                    {existing.closed_at ? format(new Date(existing.closed_at), "dd/MM/yyyy HH:mm") : "—"}
                  </span>
                  <span className="text-muted-foreground">
                    Decisão: <strong>{closureDecisionLabel(existing.closure_decision as ClosureDecision)}</strong>
                  </span>
                </div>
                {existing.closure_notes && <p>Motivo: {existing.closure_notes}</p>}
              </div>
            )}

            {!closed && isAdmin && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileWarning className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium">Conciliação do ponto</p>
                </div>
                <div className="grid gap-2 md:grid-cols-4 text-xs">
                  <Stat label="Diferença negativa do ponto" v={-attendanceTotals.negative} muted />
                  <Stat label="Débitos já lançados" v={-attendanceTotals.alreadyAdjusted} muted />
                  <Stat label="A conciliar (proposta)" v={-attendanceTotals.pendingDebit} highlight />
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] text-muted-foreground">Pendentes positivos a aprovar</p>
                    <p className="font-mono font-bold">{pendingPositives ?? 0}</p>
                  </div>
                </div>
                {attendanceTotals.pendingDebit > 0 ? (
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={confirmReconciliation}
                      onCheckedChange={(v) => setConfirmReconciliation(!!v)}
                      className="mt-0.5"
                    />
                    <span>
                      Lançar débito de <strong>{minutesToHHMM(-attendanceTotals.pendingDebit)}</strong> no fecho.
                      Apenas débitos confirmados são lançados — horas positivas exigem aprovação manual.
                    </span>
                  </label>
                ) : attendanceTotals.alreadyAdjusted > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Já existe um débito de conciliação ativo para este mês ({minutesToHHMM(-attendanceTotals.alreadyAdjusted)}).
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sem diferença negativa do ponto para conciliar neste mês.
                  </p>
                )}
                {attendanceTotals.pendingDebit > 0 && !confirmReconciliation && (
                  <p className="text-xs text-amber-600">
                    ⚠ Existem {minutesToHHMM(-attendanceTotals.pendingDebit)} do ponto ainda não lançadas no banco.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-4 text-sm">
              <Stat label="Saldo inicial (transitado)" v={opening} />
              <Stat label="Créditos aprovados" v={preview && !("error" in preview) ? preview.approvedCredits : 0} />
              <Stat label="Débitos aprovados" v={preview && !("error" in preview) ? -preview.approvedDebits : 0} />
              <Stat label="Horas pagas (mês)" v={preview && !("error" in preview) ? preview.paid : 0} muted />
              <Stat label="Horas rejeitadas" v={preview && !("error" in preview) ? preview.rejected : 0} muted />
              <Stat label="Pendências no fecho" v={preview && !("error" in preview) ? preview.pending : 0} muted />
              <Stat label="Saldo antes do fecho" v={preview && !("error" in preview) ? preview.balanceBeforeClosure : 0} highlight />
              <Stat label="Saldo que transita" v={preview && !("error" in preview) ? preview.carriedOver : 0} highlight />
            </div>

            {!closed && isAdmin && (
              <div className="rounded-md border p-3 space-y-3">
                {(pendingPositives ?? 0) > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-2">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-700">
                          {pendingPositives} candidato(s) de aprovação pendente(s) neste mês.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Aprove ou rejeite-os na aba <strong>Aprovações</strong> antes de fechar —
                          caso contrário os créditos correspondentes ficarão de fora do saldo transitado.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-start gap-2 text-xs cursor-pointer opacity-80">
                      <Checkbox
                        checked={forcePending}
                        onCheckedChange={(v) => { setForcePending(!!v); if (!v) setAckForce(false); }}
                        className="mt-0.5"
                      />
                      <span>Fechar mesmo assim (forçar)</span>
                    </label>
                    {forcePending && (
                      <label className="flex items-start gap-2 text-xs cursor-pointer pl-6">
                        <Checkbox
                          checked={ackForce}
                          onCheckedChange={(v) => setAckForce(!!v)}
                          className="mt-0.5"
                        />
                        <span>
                          Entendo que o fecho <strong>não incluirá</strong> os {pendingPositives} candidato(s) pendente(s).
                        </span>
                      </label>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-xs">Destino do saldo</Label>
                  <Select value={decision} onValueChange={(v) => setDecision(v as ClosureDecision)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carry_over_all">Transitar tudo para o próximo mês</SelectItem>
                      <SelectItem value="pay_all_and_zero">Pagar tudo e zerar banco</SelectItem>
                      <SelectItem value="pay_partial">Pagar parcialmente</SelectItem>
                      <SelectItem value="manual_adjustment">Ajuste manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(decision === "pay_partial" || decision === "manual_adjustment") && (
                  <div>
                    <Label className="text-xs">Horas a pagar (decimal, ex.: 5 = 5h, 1.5 = 1h30)</Label>
                    <Input type="number" min="0" step="0.25" value={paidHours} onChange={(e) => setPaidHours(e.target.value)} />
                  </div>
                )}

                {(decision === "pay_partial" || decision === "manual_adjustment" || decision === "pay_all_and_zero") && (
                  <div>
                    <Label className="text-xs">
                      Motivo {decision === "pay_all_and_zero" ? "(opcional)" : "(obrigatório)"}
                    </Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  </div>
                )}

                {preview && "error" in preview && (
                  <p className="text-sm text-destructive">⚠ {preview.error}</p>
                )}

                {decision === "pay_all_and_zero" ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={!!(preview && "error" in preview) || closeMut.isPending || ((pendingPositives ?? 0) > 0 && (!forcePending || !ackForce))}>Fechar mês</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar pagamento total</AlertDialogTitle>
                        <AlertDialogDescription>
                          Serão pagas <strong>{minutesToHHMM(preview && !("error" in preview) ? preview.paidOnClosure : 0)}</strong>
                          {" "}e o banco de horas deste funcionário ficará a <strong>0</strong> para o próximo mês.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => closeMut.mutate()}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    disabled={!!(preview && "error" in preview) || closeMut.isPending || ((pendingPositives ?? 0) > 0 && (!forcePending || !ackForce))}
                    onClick={() => closeMut.mutate()}
                  >
                    Fechar mês
                  </Button>
                )}

                <div className="pt-2 border-t border-dashed">
                  <Dialog open={zeroOpen} onOpenChange={setZeroOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!!(preview && "error" in preview) || ((pendingPositives ?? 0) > 0 && (!forcePending || !ackForce))}
                      >
                        Zerar saldo (sem pagar)
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Zerar banco de horas</DialogTitle>
                        <DialogDescription>
                          Esta ação cria um movimento de ajuste manual auditável que anula o saldo
                          atual (<strong>{minutesToHHMM(balanceBeforeClosure)}</strong>) e fecha o mês
                          com saldo a transitar = <strong>0:00</strong>. Não há pagamento associado.
                          Use apenas em casos excecionais (regularização, acordo com o colaborador).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label className="text-xs">Motivo (obrigatório)</Label>
                        <Textarea rows={3} value={zeroNotes} onChange={(e) => setZeroNotes(e.target.value)} />
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setZeroOpen(false)}>Cancelar</Button>
                        <Button
                          variant="destructive"
                          disabled={!zeroNotes.trim() || zeroOutMut.isPending}
                          onClick={() => zeroOutMut.mutate()}
                        >
                          Confirmar e zerar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}

            {closed && isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Reabrir mês</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reabrir fecho mensal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O movimento de pagamento associado será marcado como cancelado (sem ser apagado).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => existing && reopenMut.mutate(existing.id)}>Reabrir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {isAdmin && (
              <div className="pt-2 border-t">
                <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">Criar regularização inicial</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Regularização inicial do banco de horas</DialogTitle>
                      <DialogDescription>
                        Cria um movimento de débito auditável até uma data de corte. Útil para arrancar
                        com um saldo histórico (diferenças do ponto antes deste sistema). Não duplica:
                        já existe ativo para a mesma data → será bloqueado.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Data de corte</Label>
                        <Input type="date" value={snapshotCutoff} onChange={(e) => setSnapshotCutoff(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Horas a debitar (decimal, ex.: 3 = 3h, 1.5 = 1h30)</Label>
                        <Input type="number" min="0" step="0.25" value={snapshotHours} onChange={(e) => setSnapshotHours(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Motivo (obrigatório)</Label>
                        <Textarea rows={2} value={snapshotNotes} onChange={(e) => setSnapshotNotes(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setSnapshotOpen(false)}>Cancelar</Button>
                      <Button
                        disabled={!snapshotCutoff || !snapshotHours || !snapshotNotes.trim() || snapshotMut.isPending}
                        onClick={() => snapshotMut.mutate()}
                      >
                        Criar regularização
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, v, highlight, muted }: { label: string; v: number; highlight?: boolean; muted?: boolean }) {
  const color = muted ? "text-muted-foreground" : v > 0 ? "text-primary" : v < 0 ? "text-destructive" : "text-foreground";
  return (
    <div className={`rounded-md border p-2 ${highlight ? "bg-primary/5 border-primary/30" : ""}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-mono font-bold ${color}`}>{minutesToHHMM(v)}</p>
    </div>
  );
}