import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  vehicles: any[];
  employees: any[];
  saving?: boolean;
}

export default function VehicleMaintenanceFormDialog({ open, onClose, onSave, vehicles, employees, saving }: Props) {
  const [form, setForm] = useState({
    vehicle_id: "", type: "preventive", description: "", maintenance_date: new Date().toISOString().split("T")[0],
    next_maintenance_date: "", next_maintenance_km: "", km_at_maintenance: "", cost: "",
    provider: "", parts_replaced: "", performed_by: "", status: "completed", notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        vehicle_id: "", type: "preventive", description: "", maintenance_date: new Date().toISOString().split("T")[0],
        next_maintenance_date: "", next_maintenance_km: "", km_at_maintenance: "", cost: "",
        provider: "", parts_replaced: "", performed_by: "", status: "completed", notes: "",
      });
    }
  }, [open]);

  const handleSubmit = () => {
    onSave({
      ...form,
      next_maintenance_date: form.next_maintenance_date || null,
      next_maintenance_km: form.next_maintenance_km ? parseInt(form.next_maintenance_km) : null,
      km_at_maintenance: form.km_at_maintenance ? parseInt(form.km_at_maintenance) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
      performed_by: form.performed_by || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registar Manutenção</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label>Veículo *</Label>
            <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Preventiva</SelectItem>
                  <SelectItem value="corrective">Corretiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Data *</Label><Input type="date" value={form.maintenance_date} onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))} /></div>
            <div><Label>KM no momento</Label><Input type="number" value={form.km_at_maintenance} onChange={e => setForm(f => ({ ...f, km_at_maintenance: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Próxima manutenção</Label><Input type="date" value={form.next_maintenance_date} onChange={e => setForm(f => ({ ...f, next_maintenance_date: e.target.value }))} /></div>
            <div><Label>Próxima KM</Label><Input type="number" value={form.next_maintenance_km} onChange={e => setForm(f => ({ ...f, next_maintenance_km: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Custo (€)</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
            <div><Label>Oficina</Label><Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} /></div>
          </div>
          <div><Label>Peças substituídas</Label><Input value={form.parts_replaced} onChange={e => setForm(f => ({ ...f, parts_replaced: e.target.value }))} /></div>
          <div>
            <Label>Realizado por</Label>
            <Select value={form.performed_by} onValueChange={v => setForm(f => ({ ...f, performed_by: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.description.trim() || !form.maintenance_date || saving}>
            {saving ? "A guardar..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
