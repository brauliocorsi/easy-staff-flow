import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateEmployee, useUpdateEmployee, useEmployees, type Employee } from "@/hooks/useEmployees";

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

export function EmployeeFormDialog({ open, onClose, employee }: Props) {
  const isEdit = !!employee;
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const loading = createMutation.isPending || updateMutation.isPending;
  const { data: allEmployees } = useEmployees("");

  const [form, setForm] = useState({
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    nif: employee?.nif || "",
    niss: employee?.niss || "",
    position: employee?.position || "",
    status: employee?.status || "active",
    pin_code: employee?.pin_code || "",
    morada: employee?.morada || "",
    cidade: employee?.cidade || "",
    distrito: employee?.distrito || "",
    codigo_postal: employee?.codigo_postal || "",
    manager_id: employee?.manager_id || "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Preencha nome, apelido e email");
      return;
    }

    const payload = {
      ...form,
      manager_id: form.manager_id || null,
    };

    try {
      if (isEdit && employee) {
        await updateMutation.mutateAsync({ id: employee.id, ...payload });
        toast.success("Funcionário atualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Funcionário cadastrado");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar funcionário");
    }
  };

  // Filter out current employee from manager list
  const managerOptions = (allEmployees || []).filter(
    (e) => e.id !== employee?.id && e.status === "active"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? "Editar Funcionário" : "Novo Funcionário"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados do funcionário" : "Preencha os dados para cadastrar"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nome *</Label>
              <Input id="first_name" value={form.first_name} onChange={(e) => handleChange("first_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apelido *</Label>
              <Input id="last_name" value={form.last_name} onChange={(e) => handleChange("last_name", e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input id="nif" value={form.nif} onChange={(e) => handleChange("nif", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="niss">NISS</Label>
            <Input id="niss" value={form.niss} onChange={(e) => handleChange("niss", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Cargo</Label>
              <Input id="position" value={form.position} onChange={(e) => handleChange("position", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin_code">PIN (4 dígitos)</Label>
              <Input id="pin_code" maxLength={4} value={form.pin_code} onChange={(e) => handleChange("pin_code", e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gestor direto</Label>
            <Select value={form.manager_id} onValueChange={(v) => handleChange("manager_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem gestor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem gestor</SelectItem>
                {managerOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="morada">Morada</Label>
            <Input id="morada" value={form.morada} onChange={(e) => handleChange("morada", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distrito">Distrito</Label>
              <Input id="distrito" value={form.distrito} onChange={(e) => handleChange("distrito", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo_postal">Código Postal</Label>
              <Input id="codigo_postal" value={form.codigo_postal} onChange={(e) => handleChange("codigo_postal", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="on_leave">Afastado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
