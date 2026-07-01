import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { minutesToHHMM } from "@/lib/timeClock";
import { ApproveOvertimeDialog } from "./ApproveOvertimeDialog";

const KIND_LABEL: Record<string, string> = {
  overtime: "Hora Extra",
  day_off_work: "Trabalho em Folga",
  holiday_work: "Trabalho em Feriado",
  vacation_work: "Trabalho em Férias",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente de Aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

export function OvertimeApprovalsTab({ employeeId }: { employeeId?: string }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [confirmBackfillOpen, setConfirmBackfillOpen] = useState(false);

  const { data: approvals, error: approvalsError } = useQuery({
    queryKey: ["overtime-approvals", employeeId ?? "all", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("overtime_approvals")
        .select("*, employees:employee_id (first_name, last_name)")
        .order("record_date", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (approvalsError) {
      toast.error(`Erro ao carregar aprovações: ${(approvalsError as any)?.message ?? approvalsError}`);
    }
  }, [approvalsError]);

  const pendingRows = useMemo(
    () => (approvals || []).filter((a) => a.status === "pending"),
    [approvals],
  );
  const selectedRows = useMemo(
    () => pendingRows.filter((a) => selectedIds.has(a.id)),
    [pendingRows, selectedIds],
  );
  const totalMinutes = selectedRows.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
  const distinctEmployees = new Set(selectedRows.map((r) => r.employee_id)).size;
  const allSelected = pendingRows.length > 0 && selectedRows.length === pendingRows.length;

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(pendingRows.map((r) => r.id)) : new Set());
  };

  const runBackfill = async () => {
    setBackfillRunning(true);
    try {
      const { data: firstRec, error: firstErr } = await supabase
        .from("time_clock_records")
        .select("record_date")
        .order("record_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstErr) throw firstErr;
      if (!firstRec?.record_date) {
        toast.info("Sem registos de ponto para varrer.");
        return;
      }
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const to = yesterday.toISOString().slice(0, 10);

      const { data, error } = await supabase.functions.invoke(
        "generate-overtime-approvals",
        { body: { from: firstRec.record_date, to } },
      );
      if (error) throw error;
      const created = (data as any)?.created ?? 0;
      const bk = (data as any)?.by_kind ?? {};
      toast.success(
        `Varredura concluída: ${created} novo(s) candidato(s) pendente(s)` +
          (created > 0
            ? ` (extra: ${bk.overtime ?? 0}, folga: ${bk.day_off_work ?? 0}, feriado: ${bk.holiday_work ?? 0}, férias: ${bk.vacation_work ?? 0})`
            : ""),
      );
      qc.invalidateQueries({ queryKey: ["overtime-approvals"] });
    } catch (e: any) {
      toast.error(`Falha na varredura: ${e?.message ?? e}`);
    } finally {
      setBackfillRunning(false);
      setConfirmBackfillOpen(false);
    }
  };

  const runBatch = async () => {
    setBatchRunning(true);
    let ok = 0;
    let fail = 0;
    for (const row of selectedRows) {
      const { error } = await supabase.rpc("review_overtime_approval" as any, {
        _approval_id: row.id,
        _decision: "credit_to_bank",
        _notes: null,
      });
      if (error) fail++; else ok++;
    }
    setBatchRunning(false);
    setConfirmBatchOpen(false);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["overtime-approvals"] });
    qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
    qc.invalidateQueries({ queryKey: ["overtime-all-approved-movements"] });
    qc.invalidateQueries({ queryKey: ["overtime-exceptional-movements"] });
    if (fail === 0) toast.success(`${ok} aprovação(ões) creditada(s) no banco`);
    else toast.warning(`${ok} aprovada(s), ${fail} falharam`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-lg">Aprovações de Horas Extra / Folga / Feriado</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmBackfillOpen(true)}
            disabled={backfillRunning}
            className="gap-2"
            title="Detetar todos os dias excepcionais desde o primeiro registo de ponto até ontem"
          >
            {backfillRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Gerar pendentes retroativos
          </Button>
          {statusFilter === "pending" && selectedRows.length > 0 && (
            <Button
              size="sm"
              onClick={() => setConfirmBatchOpen(true)}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Aprovar selecionados ({selectedRows.length})
            </Button>
          )}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setSelectedIds(new Set()); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {statusFilter === "pending" && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => toggleAll(!!c)}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
              )}
              {!employeeId && <TableHead>Funcionário</TableHead>}
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Minutos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Decisão</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(approvals ?? []).map((a) => (
              <TableRow key={a.id}>
                {statusFilter === "pending" && (
                  <TableCell>
                    {a.status === "pending" ? (
                      <Checkbox
                        checked={selectedIds.has(a.id)}
                        onCheckedChange={(c) => toggleRow(a.id, !!c)}
                        aria-label="Selecionar linha"
                      />
                    ) : null}
                  </TableCell>
                )}
                {!employeeId && (
                  <TableCell>{a.employees?.first_name} {a.employees?.last_name}</TableCell>
                )}
                <TableCell className="font-mono text-sm">{a.record_date}</TableCell>
                <TableCell>{KIND_LABEL[a.kind] ?? a.kind}</TableCell>
                <TableCell className="text-right font-mono">{minutesToHHMM(a.minutes)}</TableCell>
                <TableCell>
                  <Badge variant={a.status === "pending" ? "secondary" : a.status === "approved" ? "default" : "destructive"}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{a.decision ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {a.status === "pending" && (
                    <Button size="sm" onClick={() => { setSelected(a); setDialogOpen(true); }}>
                      Decidir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!approvals || approvals.length === 0) && (
              <TableRow>
                <TableCell colSpan={(employeeId ? 6 : 7) + (statusFilter === "pending" ? 1 : 0)} className="text-center text-muted-foreground py-6">
                  Sem aprovações neste filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ApproveOvertimeDialog approval={selected} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={confirmBatchOpen} onOpenChange={setConfirmBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Vai aprovar <strong>{selectedRows.length}</strong> registo(s), totalizando{" "}
              <strong>{minutesToHHMM(totalMinutes)}</strong>, que serão creditados no banco de horas
              de <strong>{distinctEmployees}</strong> colaborador(es). Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runBatch(); }}
              disabled={batchRunning}
            >
              {batchRunning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A processar…</>
              ) : "Confirmar e creditar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBackfillOpen} onOpenChange={setConfirmBackfillOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar pendentes retroativos</AlertDialogTitle>
            <AlertDialogDescription>
              Vai varrer TODOS os dias desde o primeiro registo de ponto até ontem, detetando trabalho em
              folga, fim de semana e feriado, e horas extra acima da tolerância. Cria apenas candidatos
              <strong> pendentes</strong> — nada é creditado no banco sem a sua aprovação. A operação é
              idempotente: candidatos já decididos não são reabertos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={backfillRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runBackfill(); }}
              disabled={backfillRunning}
            >
              {backfillRunning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A varrer…</>
              ) : "Iniciar varredura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}