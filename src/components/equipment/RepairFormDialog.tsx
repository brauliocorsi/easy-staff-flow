import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  machineId?: string;
}

export function RepairFormDialog({ open, onClose, machineId }: Props) {
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
    machine_id: machineId || "",
    reported_by: "",
    repair_date: new Date().toISOString().slice(0, 10),
    description: "",
    parts_replaced: "",
    company_name: "",
    technician_name: "",
    cost: "",
    status: "pending",
    resolved_date: "",
    notes: "",
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!form.machine_id || !form.description) {
      toast.error("Preencha máquina e descrição da avaria");
      return;
    }
    setSaving(true);
    try {
      let invoice_url: string | null = null;

      if (invoiceFile) {
        const path = `repairs/${form.machine_id}/${Date.now()}_${invoiceFile.name}`;
        const { error: upErr } = await supabase.storage.from("equipment").upload(path, invoiceFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("equipment").getPublicUrl(path);
        invoice_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("machine_repairs" as any).insert({
        machine_id: form.machine_id,
        reported_by: form.reported_by || null,
        repair_date: form.repair_date,
        description: form.description,
        parts_replaced: form.parts_replaced || null,
        company_name: form.company_name || null,
        technician_name: form.technician_name || null,
        cost: form.cost ? parseFloat(form.cost) : null,
        status: form.status,
        resolved_date: form.resolved_date || null,
        notes: form.notes || null,
        invoice_url,
      });
      if (error) throw error;
      toast.success("Pedido de reparação criado");
      qc.invalidateQueries({ queryKey: ["machine-repairs"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Novo Pedido de Reparação</DialogTitle>
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
            <Label>Descrição da Avaria *</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descreva o que aconteceu..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data da Reparação</Label>
              <Input type="date" value={form.repair_date} onChange={(e) => setForm((f) => ({ ...f, repair_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Curso</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reportado por</Label>
            <Select value={form.reported_by} onValueChange={(v) => setForm((f) => ({ ...f, reported_by: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Peças Substituídas</Label>
            <Input value={form.parts_replaced} onChange={(e) => setForm((f) => ({ ...f, parts_replaced: e.target.value }))} placeholder="Ex: Correia, rolamento..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-2">
              <Label>Técnico</Label>
              <Input value={form.technician_name} onChange={(e) => setForm((f) => ({ ...f, technician_name: e.target.value }))} placeholder="Nome do técnico" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Custo (€)</Label>
              <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Data Resolução</Label>
              <Input type="date" value={form.resolved_date} onChange={(e) => setForm((f) => ({ ...f, resolved_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fatura / Comprovativo</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notas adicionais..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
