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

export function EpiFormDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: employees } = useEmployees("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    item_name: "",
    quantity: "1",
    delivery_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.employee_id || !form.item_name) {
      toast.error("Preencha funcionário e nome do EPI");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("epi_deliveries" as any).insert({
        employee_id: form.employee_id,
        item_name: form.item_name,
        quantity: parseInt(form.quantity) || 1,
        delivery_date: form.delivery_date,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("EPI registado com sucesso");
      qc.invalidateQueries({ queryKey: ["epi-deliveries"] });
      onClose();
      setForm({ employee_id: "", item_name: "", quantity: "1", delivery_date: new Date().toISOString().slice(0, 10), expiry_date: "", notes: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Registar Entrega de EPI</DialogTitle>
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
            <Label>Nome do EPI *</Label>
            <Input value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} placeholder="Ex: Capacete, Luvas, Botas..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Data Entrega</Label>
              <Input type="date" value={form.delivery_date} onChange={(e) => setForm((f) => ({ ...f, delivery_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Validade</Label>
            <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
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
