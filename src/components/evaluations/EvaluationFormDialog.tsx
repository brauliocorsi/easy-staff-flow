import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EvaluationFormDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [evaluatorId, setEvaluatorId] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["employees-for-eval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!employeeId || !evaluatorId) {
      toast.error("Selecione o funcionário e o avaliador");
      return;
    }
    if (employeeId === evaluatorId) {
      toast.error("O avaliador não pode ser o próprio funcionário");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("employee_evaluations").insert({
        employee_id: employeeId,
        evaluator_id: evaluatorId,
        requested_by: user!.id,
        status: "pending",
      } as any);
      if (error) throw error;
      toast.success("Avaliação solicitada com sucesso");
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      setEmployeeId("");
      setEvaluatorId("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar avaliação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Avaliação</DialogTitle>
          <DialogDescription>Atribua a um líder a avaliação de um funcionário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário a avaliar</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
              <SelectContent>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} — {e.position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Líder avaliador</Label>
            <Select value={evaluatorId} onValueChange={setEvaluatorId}>
              <SelectTrigger><SelectValue placeholder="Selecionar avaliador" /></SelectTrigger>
              <SelectContent>
                {employees?.filter((e) => e.id !== employeeId).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} — {e.position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Solicitar Avaliação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
