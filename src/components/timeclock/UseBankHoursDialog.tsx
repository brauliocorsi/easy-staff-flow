import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Admin dialog to record a DEBIT in the time bank (employee used bank hours
 * to leave early, compensate partial absence, etc.). Creates an approved
 * movement with effective_minutes < 0.
 */
export function UseBankHoursDialog({
  defaultEmployeeId,
  open,
  onOpenChange,
}: {
  defaultEmployeeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [reason, setReason] = useState("");
  const [sourceType, setSourceType] = useState<"compensation_used" | "absence_compensation">("compensation_used");

  const { data: employees } = useQuery({
    queryKey: ["employees-debit-dialog"],
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

  const mutation = useMutation({
    mutationFn: async () => {
      const total = (parseInt(hours || "0", 10) || 0) * 60 + (parseInt(minutes || "0", 10) || 0);
      if (!employeeId) throw new Error("Selecione o funcionário");
      if (total <= 0) throw new Error("Indique uma duração maior que zero");
      if (!reason.trim()) throw new Error("Motivo obrigatório");

      const { error } = await supabase.from("time_bank_movements").insert({
        employee_id: employeeId,
        record_date: date,
        source_type: sourceType,
        movement_type: "debit",
        minutes: total,
        effective_minutes: -total,
        decision: "use_bank_hours",
        status: "approved",
        description: reason,
        created_by: user?.id ?? null,
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Débito registado no banco de horas");
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
      onOpenChange(false);
      setHours("0"); setMinutes("0"); setReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registar débito"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usar horas do banco</DialogTitle>
          <DialogDescription>
            Regista um débito no banco de horas (ex.: saída antecipada, compensação de ausência).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Funcionário *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compensation_used">Banco Usado pelo Funcionário</SelectItem>
                  <SelectItem value="absence_compensation">Compensação de Ausência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Horas</Label>
              <Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <Label>Minutos</Label>
              <Input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Motivo *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "A registar..." : "Registar débito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}