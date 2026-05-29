import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { minutesToHHMM } from "@/lib/timeClock";
import {
  computeMonthlyClosure, closureDecisionLabel,
  type ClosureDecision, type MovementLike,
} from "@/lib/timeBank";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

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

  const opening = prevClosure?.carried_over_minutes ?? 0;
  const previousMonthClosed = !!prevClosure;
  const hasPriorMovements = (priorMovementsCount ?? 0) > 0;
  const blockedByMissingPrev = hasPriorMovements && !previousMonthClosed;
  const paidMinutes = decision === "pay_partial" || decision === "manual_adjustment"
    ? Math.round((parseFloat(paidHours || "0") || 0) * 60) : undefined;

  const preview = useMemo(() => {
    if (!movements) return null;
    try {
      return computeMonthlyClosure({
        opening, movementsInMonth: movements, decision, paidMinutes, notes,
        previousMonthClosed, hasPriorMovements,
      });
    } catch (e: any) {
      return { error: e.message as string };
    }
  }, [movements, opening, decision, paidMinutes, notes, previousMonthClosed, hasPriorMovements]);

  const closeMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("close_time_bank_month", {
        _employee_id: effectiveEmp!,
        _year: year, _month: month,
        _decision: decision,
        _paid_minutes: paidMinutes ?? 0,
        _notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Mês fechado", description: "Fecho registado com sucesso." });
      qc.invalidateQueries({ queryKey: ["closure-existing"] });
      qc.invalidateQueries({ queryKey: ["closure-movements"] });
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
      setNotes(""); setPaidHours("");
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
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
    },
    onError: (e: any) => toast({ title: "Erro ao reabrir", description: e.message, variant: "destructive" }),
  });

  const closed = !!existing?.is_locked;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {closed ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          Fecho Mensal do Banco de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                      <Button disabled={!!(preview && "error" in preview) || closeMut.isPending}>Fechar mês</Button>
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
                  <Button disabled={!!(preview && "error" in preview) || closeMut.isPending} onClick={() => closeMut.mutate()}>
                    Fechar mês
                  </Button>
                )}
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