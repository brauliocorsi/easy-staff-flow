import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function MaintenanceTaskFormDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: employees } = useEmployees("");
  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines" as any).select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    machine_id: "",
    employee_id: "",
    frequency: "weekly",
    day_of_week: "",
    day_of_month: "",
    title: "",
  });

  const handleSubmit = async () => {
    if (!form.machine_id || !form.employee_id || !form.title) {
      toast.error("Preencha máquina, funcionário e título");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("maintenance_tasks" as any).insert({
        machine_id: form.machine_id,
        employee_id: form.employee_id,
        frequency: form.frequency,
        day_of_week: form.frequency === "weekly" && form.day_of_week ? parseInt(form.day_of_week) : null,
        day_of_month: form.frequency === "monthly" && form.day_of_month ? parseInt(form.day_of_month) : null,
        title: form.title,
      });
      if (error) throw error;
      toast.success("Tarefa de manutenção criada");
      qc.invalidateQueries({ queryKey: ["maintenance-tasks"] });
      onClose();
      setForm({ machine_id: "", employee_id: "", frequency: "weekly", day_of_week: "", day_of_month: "", title: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Tarefa de Manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Máquina *</Label>
            <Select value={form.machine_id} onValueChange={(v) => setForm((f) => ({ ...f, machine_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {(machines || []).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}{m.location ? ` (${m.location})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título da Tarefa *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Manutenção preventiva do compressor" />
          </div>
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diária</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Dia da Semana</Label>
              <Select value={form.day_of_week} onValueChange={(v) => setForm((f) => ({ ...f, day_of_week: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.frequency === "monthly" && (
            <div className="space-y-2">
              <Label>Dia do Mês</Label>
              <Input type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))} placeholder="1-31" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar Tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
