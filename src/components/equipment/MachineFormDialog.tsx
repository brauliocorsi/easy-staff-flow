import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ChecklistField {
  field: string;
  label: string;
  type: "checkbox" | "text" | "number" | "select";
  options?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  machine?: any;
}

export function MachineFormDialog({ open, onClose, machine }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: machine?.name || "",
    location: machine?.location || "",
    description: machine?.description || "",
  });
  const [checklist, setChecklist] = useState<ChecklistField[]>(
    machine?.checklist_template || []
  );
  const [newField, setNewField] = useState({ label: "", type: "checkbox" as ChecklistField["type"], options: "" });

  const addField = () => {
    if (!newField.label.trim()) return;
    const fieldKey = newField.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const entry: ChecklistField = {
      field: fieldKey,
      label: newField.label,
      type: newField.type,
    };
    if (newField.type === "select" && newField.options) {
      entry.options = newField.options.split(",").map((o) => o.trim()).filter(Boolean);
    }
    setChecklist((prev) => [...prev, entry]);
    setNewField({ label: "", type: "checkbox", options: "" });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Nome da máquina obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        location: form.location || null,
        description: form.description || null,
        checklist_template: checklist,
      };
      if (machine) {
        const { error } = await supabase.from("machines" as any).update(payload).eq("id", machine.id);
        if (error) throw error;
        toast.success("Máquina atualizada");
      } else {
        const { error } = await supabase.from("machines" as any).insert(payload);
        if (error) throw error;
        toast.success("Máquina registada");
      }
      qc.invalidateQueries({ queryKey: ["machines"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{machine ? "Editar Máquina" : "Nova Máquina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Compressor, Torno..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>

          {/* Checklist Template Editor */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Template de Checklist</Label>
            {checklist.length > 0 && (
              <div className="space-y-2">
                {checklist.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md border text-sm">
                    <div>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-muted-foreground ml-2">({f.type})</span>
                      {f.options && <span className="text-xs text-muted-foreground ml-1">[{f.options.join(", ")}]</span>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChecklist((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <p className="text-xs text-muted-foreground font-medium">Adicionar campo:</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome do campo" value={newField.label} onChange={(e) => setNewField((f) => ({ ...f, label: e.target.value }))} />
                <Select value={newField.type} onValueChange={(v: any) => setNewField((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="select">Seleção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newField.type === "select" && (
                <Input placeholder="Opções separadas por vírgula (Ex: OK, Baixo, Crítico)" value={newField.options} onChange={(e) => setNewField((f) => ({ ...f, options: e.target.value }))} />
              )}
              <Button variant="outline" size="sm" onClick={addField} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {machine ? "Guardar" : "Registar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
