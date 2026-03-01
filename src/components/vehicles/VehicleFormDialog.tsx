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
  vehicle?: any;
  employees: any[];
  saving?: boolean;
}

export default function VehicleFormDialog({ open, onClose, onSave, vehicle, employees, saving }: Props) {
  const [form, setForm] = useState({
    plate: "", brand: "", model: "", year: "", color: "", vin: "",
    fuel_type: "diesel", km_current: "", assigned_employee_id: "", status: "active", notes: "",
  });

  useEffect(() => {
    if (vehicle) {
      setForm({
        plate: vehicle.plate || "",
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        year: vehicle.year?.toString() || "",
        color: vehicle.color || "",
        vin: vehicle.vin || "",
        fuel_type: vehicle.fuel_type || "diesel",
        km_current: vehicle.km_current?.toString() || "",
        assigned_employee_id: vehicle.assigned_employee_id || "",
        status: vehicle.status || "active",
        notes: vehicle.notes || "",
      });
    } else {
      setForm({ plate: "", brand: "", model: "", year: "", color: "", vin: "", fuel_type: "diesel", km_current: "", assigned_employee_id: "", status: "active", notes: "" });
    }
  }, [vehicle, open]);

  const handleSubmit = () => {
    onSave({
      ...form,
      year: form.year ? parseInt(form.year) : null,
      km_current: form.km_current ? parseInt(form.km_current) : 0,
      assigned_employee_id: form.assigned_employee_id || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Editar Veículo" : "Adicionar Veículo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Matrícula *</Label><Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} /></div>
            <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
            <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Cor</Label><Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
            <div><Label>Chassi (VIN)</Label><Input value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Combustível</Label>
              <Select value={form.fuel_type} onValueChange={v => setForm(f => ({ ...f, fuel_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="gasoline">Gasolina</SelectItem>
                  <SelectItem value="electric">Elétrico</SelectItem>
                  <SelectItem value="hybrid">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>KM Atual</Label><Input type="number" value={form.km_current} onChange={e => setForm(f => ({ ...f, km_current: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsável</Label>
              <Select value={form.assigned_employee_id || "none"} onValueChange={v => setForm(f => ({ ...f, assigned_employee_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="sold">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.plate.trim() || saving}>{saving ? "A guardar..." : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
