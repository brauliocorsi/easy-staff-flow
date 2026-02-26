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

const CONDITIONS = [
  { value: "new", label: "Novo" },
  { value: "good", label: "Bom" },
  { value: "fair", label: "Razoável" },
  { value: "damaged", label: "Danificado" },
];

export function ToolFormDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: employees } = useEmployees("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    tool_name: "",
    serial_number: "",
    assigned_date: new Date().toISOString().slice(0, 10),
    condition: "new",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.employee_id || !form.tool_name) {
      toast.error("Preencha funcionário e nome da ferramenta");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("tool_assignments" as any).insert({
        employee_id: form.employee_id,
        tool_name: form.tool_name,
        serial_number: form.serial_number || null,
        assigned_date: form.assigned_date,
        condition: form.condition,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("Ferramenta atribuída com sucesso");
      qc.invalidateQueries({ queryKey: ["tool-assignments"] });
      onClose();
      setForm({ employee_id: "", tool_name: "", serial_number: "", assigned_date: new Date().toISOString().slice(0, 10), condition: "new", notes: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atribuir");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Atribuir Ferramenta</DialogTitle>
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
          <div className="space-y-2">
            <Label>Nome da Ferramenta *</Label>
            <Input value={form.tool_name} onChange={(e) => setForm((f) => ({ ...f, tool_name: e.target.value }))} placeholder="Ex: Berbequim, Chave Inglesa..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nº Série</Label>
              <Input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Data Atribuição</Label>
              <Input type="date" value={form.assigned_date} onChange={(e) => setForm((f) => ({ ...f, assigned_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Condição</Label>
            <Select value={form.condition} onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
