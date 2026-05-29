import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { minutesToHHMM } from "@/lib/timeClock";

type Decision =
  | "credit_to_bank"
  | "pay_as_overtime"
  | "compensatory_rest"
  | "offset_negative_balance"
  | "reject";

type Approval = {
  id: string;
  employee_id: string;
  record_date: string;
  kind: "overtime" | "day_off_work" | "holiday_work";
  minutes: number;
  time_clock_record_id: string | null;
};

const KIND_LABEL: Record<Approval["kind"], string> = {
  overtime: "Hora Extra",
  day_off_work: "Trabalho em Dia de Folga",
  holiday_work: "Trabalho em Feriado",
};

/** Decisões que exigem motivo obrigatório (não-creditações simples). */
const DECISIONS_REQUIRING_REASON = new Set<Decision>([
  "reject",
  "pay_as_overtime",
  "compensatory_rest",
  "offset_negative_balance",
]);

export function ApproveOvertimeDialog({
  approval,
  open,
  onOpenChange,
}: {
  approval: Approval | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<Decision | "">("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!approval) throw new Error("Sem aprovação selecionada");
      if (!decision) throw new Error("Escolha o destino das horas");
      if (DECISIONS_REQUIRING_REASON.has(decision) && !notes.trim()) {
        throw new Error("Motivo obrigatório para esta decisão");
      }

      // Atomic server-side review: validates admin, updates approval AND
      // creates the time_bank_movements row in a single transaction.
      const { error } = await supabase.rpc("review_overtime_approval" as any, {
        _approval_id: approval.id,
        _decision: decision,
        _notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decisão registada");
      qc.invalidateQueries({ queryKey: ["overtime-approvals"] });
      qc.invalidateQueries({ queryKey: ["time-bank-movements"] });
      onOpenChange(false);
      setDecision("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registar decisão"),
  });

  if (!approval) return null;

  const reasonRequired = decision && DECISIONS_REQUIRING_REASON.has(decision as Decision);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decidir destino das horas</DialogTitle>
          <DialogDescription>
            {KIND_LABEL[approval.kind]} — {approval.record_date} —{" "}
            <span className="font-mono font-bold">{minutesToHHMM(approval.minutes)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Destino das horas *</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as Decision)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o destino..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_to_bank">Creditar no Banco de Horas</SelectItem>
                <SelectItem value="pay_as_overtime">Pagar como Hora Extra</SelectItem>
                <SelectItem value="compensatory_rest">Converter em Descanso Compensatório</SelectItem>
                <SelectItem value="offset_negative_balance">Usar para Abater Saldo Negativo</SelectItem>
                <SelectItem value="reject">Rejeitar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nota / motivo {reasonRequired ? "*" : "(opcional)"}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={reasonRequired ? "Obrigatório para esta decisão" : ""}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!decision || mutation.isPending || (!!reasonRequired && !notes.trim())}
          >
            {mutation.isPending ? "A registar..." : "Registar decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}