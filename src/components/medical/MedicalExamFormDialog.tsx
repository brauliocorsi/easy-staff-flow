import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MedicalExamFormDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: employees } = useEmployees("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    exam_date: new Date().toISOString().slice(0, 10),
    exam_type: "periodic",
    result: "fit",
    provider: "",
    doctor_name: "",
    notes: "",
    next_exam_date: "",
    year: new Date().getFullYear().toString(),
  });

  const handleSubmit = async () => {
    if (!form.employee_id) {
      toast.error("Selecione um funcionário");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("medical_exams" as any).insert({
        employee_id: form.employee_id,
        exam_date: form.exam_date,
        exam_type: form.exam_type,
        result: form.result,
        provider: form.provider || null,
        doctor_name: form.doctor_name || null,
        notes: form.notes || null,
        next_exam_date: form.next_exam_date || null,
        year: parseInt(form.year),
      });
      if (error) throw error;
      toast.success("Exame médico registado com sucesso");
      qc.invalidateQueries({ queryKey: ["medical-exams"] });
      onClose();
      setForm({
        employee_id: "",
        exam_date: new Date().toISOString().slice(0, 10),
        exam_type: "periodic",
        result: "fit",
        provider: "",
        doctor_name: "",
        notes: "",
        next_exam_date: "",
        year: new Date().getFullYear().toString(),
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Registar Exame Médico</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data do Exame</Label>
              <Input type="date" value={form.exam_date} onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Exame</Label>
              <Select value={form.exam_type} onValueChange={(v) => setForm((f) => ({ ...f, exam_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admission">Admissão</SelectItem>
                  <SelectItem value="periodic">Periódico</SelectItem>
                  <SelectItem value="occasional">Ocasional</SelectItem>
                  <SelectItem value="return">Regresso</SelectItem>
                  <SelectItem value="dismissal">Cessação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select value={form.result} onValueChange={(v) => setForm((f) => ({ ...f, result: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Apto</SelectItem>
                  <SelectItem value="fit_conditional">Apto Condicionado</SelectItem>
                  <SelectItem value="temporarily_unfit">Inapto Temporário</SelectItem>
                  <SelectItem value="unfit">Inapto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prestador / Clínica</Label>
              <Input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="Ex: Clínica Saúde" />
            </div>
            <div className="space-y-2">
              <Label>Médico</Label>
              <Input value={form.doctor_name} onChange={(e) => setForm((f) => ({ ...f, doctor_name: e.target.value }))} placeholder="Nome do médico" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Próximo Exame</Label>
            <Input type="date" value={form.next_exam_date} onChange={(e) => setForm((f) => ({ ...f, next_exam_date: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
