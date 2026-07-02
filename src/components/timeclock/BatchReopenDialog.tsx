import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "@/hooks/use-toast";
import { minutesToHHMM } from "@/lib/timeClock";
import { Undo2, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type ClosureRow = {
  id: string;
  employee_id: string;
  period_year: number;
  period_month: number;
  carried_over_minutes: number;
  payout_movement_id: string | null;
  paid_on_closure_minutes: number | null;
};

type ExecResult = {
  employeeName: string;
  year: number;
  month: number;
  status: "success" | "failed" | "skipped";
  message?: string;
};

const monthKey = (y: number, m: number) => y * 12 + (m - 1);

const currentYM = () => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
};
const fmtYM = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const parseYM = (s: string): { y: number; m: number } | null => {
  const [ys, ms] = s.split("-");
  const y = parseInt(ys, 10); const m = parseInt(ms, 10);
  if (!y || !m || m < 1 || m > 12) return null;
  return { y, m };
};

export function BatchReopenDialog() {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExecResult[] | null>(null);
  const [ackPayouts, setAckPayouts] = useState(false);

  const now = currentYM();
  const defaultFrom = fmtYM(now.y, Math.max(1, now.m - 5));
  const defaultTo = fmtYM(now.y, now.m);
  const [fromYM, setFromYM] = useState(defaultFrom);
  const [toYM, setToYM] = useState(defaultTo);
  const [excludedEmps, setExcludedEmps] = useState<Set<string>>(new Set());

  const { data: employees } = useQuery({
    enabled: open,
    queryKey: ["batch-reopen-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const empIds = useMemo(() => (employees || []).map((e) => e.id), [employees]);
  const empName = useMemo(() => {
    const map = new Map<string, string>();
    (employees || []).forEach((e) => map.set(e.id, `${e.first_name} ${e.last_name}`));
    return map;
  }, [employees]);

  const from = parseYM(fromYM);
  const to = parseYM(toYM);
  const rangeValid = !!from && !!to && monthKey(from.y, from.m) <= monthKey(to.y, to.m);

  const { data: closures } = useQuery({
    enabled: open && empIds.length > 0 && rangeValid,
    queryKey: ["batch-reopen-closures", empIds.length, fromYM, toYM],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_bank_monthly_closures")
        .select("id, employee_id, period_year, period_month, carried_over_minutes, payout_movement_id, paid_on_closure_minutes, is_locked")
        .in("employee_id", empIds)
        .eq("is_locked", true);
      if (error) throw error;
      return (data || []) as (ClosureRow & { is_locked: boolean })[];
    },
  });

  // Filter to range + excluded employees, group by employee, sort desc by month
  const grouped = useMemo(() => {
    if (!closures || !from || !to) return [] as { empId: string; empName: string; rows: ClosureRow[] }[];
    const fromIdx = monthKey(from.y, from.m);
    const toIdx = monthKey(to.y, to.m);
    const byEmp = new Map<string, ClosureRow[]>();
    for (const c of closures) {
      if (excludedEmps.has(c.employee_id)) continue;
      const idx = monthKey(c.period_year, c.period_month);
      if (idx < fromIdx || idx > toIdx) continue;
      const arr = byEmp.get(c.employee_id) || [];
      arr.push(c);
      byEmp.set(c.employee_id, arr);
    }
    const out: { empId: string; empName: string; rows: ClosureRow[] }[] = [];
    for (const [empId, rows] of byEmp) {
      rows.sort((a, b) => monthKey(b.period_year, b.period_month) - monthKey(a.period_year, a.period_month));
      out.push({ empId, empName: empName.get(empId) || empId, rows });
    }
    out.sort((a, b) => a.empName.localeCompare(b.empName));
    return out;
  }, [closures, from, to, excludedEmps, empName]);

  const totalClosures = grouped.reduce((a, g) => a + g.rows.length, 0);
  const totalEmps = grouped.length;
  const payoutRows = grouped.flatMap((g) => g.rows.filter((r) => r.payout_movement_id || (r.paid_on_closure_minutes || 0) > 0));
  const hasPayouts = payoutRows.length > 0;

  const toggleEmp = (id: string) => {
    setExcludedEmps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const executeBatch = async () => {
    setRunning(true);
    const out: ExecResult[] = [];
    for (const g of grouped) {
      let chainBroken = false;
      for (const row of g.rows) {
        if (chainBroken) {
          out.push({
            employeeName: g.empName, year: row.period_year, month: row.period_month,
            status: "skipped", message: "Cadeia interrompida por falha anterior",
          });
          continue;
        }
        const { error } = await supabase.rpc("reopen_time_bank_month", { _closure_id: row.id });
        if (error) {
          out.push({
            employeeName: g.empName, year: row.period_year, month: row.period_month,
            status: "failed", message: error.message || String(error),
          });
          chainBroken = true;
        } else {
          out.push({
            employeeName: g.empName, year: row.period_year, month: row.period_month,
            status: "success",
          });
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
    qc.invalidateQueries({ queryKey: ["batch-reopen-closures"] });
    qc.invalidateQueries({ queryKey: ["monthly-closures"] });
    qc.invalidateQueries({ queryKey: ["all-closures"] });

    const ok = out.filter((r) => r.status === "success").length;
    const failed = out.filter((r) => r.status === "failed").length;
    toast({
      title: "Reabertura em lote concluída",
      description: `${ok} reaberto(s), ${failed} falha(s).`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  if (!isAdmin) return null;

  const confirmDisabled =
    running || totalClosures === 0 || !rangeValid || (hasPayouts && !ackPayouts);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResults(null); setAckPayouts(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Undo2 className="h-4 w-4" /> Reabrir meses em lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reabertura em lote — fechos mensais</DialogTitle>
          <DialogDescription>
            Reabre fechos travados no intervalo escolhido. Cada colaborador é
            processado do mês <strong>mais recente para o mais antigo</strong>,
            porque o carry-over exige o mês seguinte destravado primeiro.
            Nada é gravado até confirmar.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <ResultsView results={results} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">De (mês)</Label>
                <Input type="month" value={fromYM} onChange={(e) => setFromYM(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até (mês)</Label>
                <Input type="month" value={toYM} onChange={(e) => setToYM(e.target.value)} />
              </div>
            </div>

            {!rangeValid && (
              <p className="text-xs text-destructive">Intervalo inválido.</p>
            )}

            {employees && employees.length > 0 && (
              <div>
                <Label className="text-xs">Colaboradores (desmarque para excluir)</Label>
                <ScrollArea className="h-[120px] rounded-md border p-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {employees.map((e) => {
                      const included = !excludedEmps.has(e.id);
                      return (
                        <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={included} onCheckedChange={() => toggleEmp(e.id)} />
                          <span>{e.first_name} {e.last_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {totalClosures} fecho(s) de {totalEmps} colaborador(es) serão reabertos.
              {hasPayouts && (
                <span className="ml-2 text-destructive font-medium">
                  {payoutRows.length} com pagamento — será cancelado.
                </span>
              )}
            </div>

            {hasPayouts && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2">
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <Checkbox checked={ackPayouts} onCheckedChange={(v) => setAckPayouts(!!v)} className="mt-0.5" />
                  <span>
                    Entendo que os movimentos de pagamento nos fechos destacados serão <strong>cancelados</strong>.
                  </span>
                </label>
              </div>
            )}

            <ScrollArea className="h-[360px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead className="text-right">Saldo transitado</TableHead>
                    <TableHead className="text-right">Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.flatMap((g) =>
                    g.rows.map((r, i) => {
                      const hasPay = !!r.payout_movement_id || (r.paid_on_closure_minutes || 0) > 0;
                      return (
                        <TableRow key={r.id} className={hasPay ? "bg-destructive/10" : ""}>
                          <TableCell className="font-medium">{g.empName}</TableCell>
                          <TableCell>{String(r.period_month).padStart(2, "0")}/{r.period_year}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}º</TableCell>
                          <TableCell className="text-right font-mono text-xs">{minutesToHHMM(r.carried_over_minutes)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {hasPay ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {minutesToHHMM(r.paid_on_closure_minutes || 0)}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {grouped.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        Nenhum fecho travado no intervalo selecionado.
                      </TableCell>
                    </TableRow>
                  )}
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
              <Button variant="destructive" onClick={executeBatch} disabled={confirmDisabled}>
                {running
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A reabrir…</>
                  : `Confirmar e reabrir (${totalClosures})`}
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
        <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />{ok.length} reabertos</Badge>
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