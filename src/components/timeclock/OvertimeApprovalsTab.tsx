import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { minutesToHHMM } from "@/lib/timeClock";
import { ApproveOvertimeDialog } from "./ApproveOvertimeDialog";

const KIND_LABEL: Record<string, string> = {
  overtime: "Hora Extra",
  day_off_work: "Trabalho em Folga",
  holiday_work: "Trabalho em Feriado",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente de Aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

export function OvertimeApprovalsTab({ employeeId }: { employeeId?: string }) {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: approvals } = useQuery({
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Aprovações de Horas Extra / Folga / Feriado</CardTitle>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={employeeId ? 6 : 7} className="text-center text-muted-foreground py-6">
                  Sem aprovações neste filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ApproveOvertimeDialog approval={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}