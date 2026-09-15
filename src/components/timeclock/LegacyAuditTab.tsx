import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, Loader2, ScrollText } from "lucide-react";
import { minutesToHHMM } from "@/lib/timeClock";

type Divergence = {
  employeeId: string;
  name: string;
  lastClosed: string;
  closureBalance: number;
  ledgerBalance: number;
  difference: number;
  pendingInClosedMonths: number;
};

const monthIndex = (y: number, m: number) => y * 12 + (m - 1);
const monthEnd = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

/**
 * Painel histórico SOMENTE LEITURA.
 * Recalcula as divergências no momento da consulta — nada é corrigido,
 * nada é gravado e nenhuma contagem fica congelada.
 */
export function LegacyAuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["legacy-audit"],
    queryFn: async () => {
      const [employees, closures, movements, approvals] = await Promise.all([
        supabase.from("employees").select("id, first_name, last_name"),
        supabase
          .from("time_bank_monthly_closures")
          .select("employee_id, period_year, period_month, closing_balance_minutes, carried_over_minutes, is_locked"),
        supabase
          .from("time_bank_movements")
          .select("employee_id, record_date, effective_minutes, status"),
        supabase
          .from("overtime_approvals")
          .select("employee_id, record_date, minutes, status, needs_review"),
      ]);
      const err = employees.error || closures.error || movements.error || approvals.error;
      if (err) throw err;
      return {
        employees: employees.data ?? [],
        closures: closures.data ?? [],
        movements: movements.data ?? [],
        approvals: approvals.data ?? [],
      };
    },
  });

  const { rows, pendingTotal, flaggedTotal } = useMemo(() => {
    if (!data) return { rows: [] as Divergence[], pendingTotal: 0, flaggedTotal: 0 };

    const nameById = new Map(
      data.employees.map((e: any) => [e.id, `${e.first_name} ${e.last_name}`]),
    );

    // Último mês fechado (com cadeado) por colaborador.
    const lastLocked = new Map<string, { year: number; month: number; balance: number }>();
    for (const c of data.closures as any[]) {
      if (!c.is_locked) continue;
      const cur = lastLocked.get(c.employee_id);
      if (!cur || monthIndex(c.period_year, c.period_month) > monthIndex(cur.year, cur.month)) {
        lastLocked.set(c.employee_id, {
          year: c.period_year,
          month: c.period_month,
          balance: Number(c.carried_over_minutes ?? c.closing_balance_minutes ?? 0),
        });
      }
    }

    // Candidatos por decidir ou sinalizados dentro de meses já fechados.
    const lockedMonths = new Set(
      (data.closures as any[])
        .filter((c) => c.is_locked)
        .map((c) => `${c.employee_id}:${c.period_year}-${String(c.period_month).padStart(2, "0")}`),
    );
    const pendingClosed = new Map<string, number>();
    let pendingTotal = 0;
    let flaggedTotal = 0;
    for (const a of data.approvals as any[]) {
      const key = `${a.employee_id}:${String(a.record_date).slice(0, 7)}`;
      const inClosed = lockedMonths.has(key);
      if (a.status === "pending" && inClosed) {
        pendingClosed.set(a.employee_id, (pendingClosed.get(a.employee_id) ?? 0) + 1);
        pendingTotal += 1;
      }
      if (a.status !== "pending" && a.needs_review && inClosed) flaggedTotal += 1;
    }

    const rows: Divergence[] = [];
    for (const [employeeId, closed] of lastLocked) {
      const cutoff = monthEnd(closed.year, closed.month);
      const ledger = (data.movements as any[])
        .filter(
          (m) =>
            m.employee_id === employeeId &&
            (m.status === "approved" || m.status === "paid") &&
            String(m.record_date) <= cutoff,
        )
        .reduce((sum, m) => sum + (Number(m.effective_minutes) || 0), 0);

      const difference = closed.balance - ledger;
      const pending = pendingClosed.get(employeeId) ?? 0;
      if (difference === 0 && pending === 0) continue;

      rows.push({
        employeeId,
        name: nameById.get(employeeId) ?? "—",
        lastClosed: `${String(closed.month).padStart(2, "0")}/${closed.year}`,
        closureBalance: closed.balance,
        ledgerBalance: ledger,
        difference,
        pendingInClosedMonths: pending,
      });
    }
    rows.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    return { rows, pendingTotal, flaggedTotal };
  }, [data]);

  return (
    <div className="space-y-4">
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>Histórico — apenas consulta</AlertTitle>
        <AlertDescription className="text-sm">
          Esta página compara, no momento em que a abre, o saldo registado em cada fecho com o
          somatório real dos movimentos. Nada aqui altera, aprova ou corrige o histórico.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Colaboradores com diferença
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos por decidir em meses fechados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{pendingTotal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Decisões sinalizadas em meses fechados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{flaggedTotal}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Diferenças entre o fecho e o extrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem diferenças a assinalar neste momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Último mês fechado</TableHead>
                    <TableHead className="text-right">Saldo no fecho</TableHead>
                    <TableHead className="text-right">Saldo pelo extrato</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-right">Por decidir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="tabular-nums">{r.lastClosed}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {minutesToHHMM(r.closureBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {minutesToHHMM(r.ledgerBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant={r.difference === 0 ? "outline" : "destructive"}>
                          {minutesToHHMM(r.difference)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.pendingInClosedMonths || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
