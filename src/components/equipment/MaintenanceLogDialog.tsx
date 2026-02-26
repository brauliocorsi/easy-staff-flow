import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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
  task: any;
  machine: any;
}

export function MaintenanceLogDialog({ open, onClose, task, machine }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const template: ChecklistField[] = machine?.checklist_template || [];
  const [checklistData, setChecklistData] = useState<Record<string, any>>({});

  const updateField = (field: string, value: any) => {
    setChecklistData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("maintenance_logs" as any).insert({
        task_id: task.id,
        employee_id: task.employee_id,
        machine_id: task.machine_id,
        completed_date: new Date().toISOString().slice(0, 10),
        checklist_data: checklistData,
        notes: notes || null,
        status: "completed",
      });
      if (error) throw error;
      toast.success("Manutenção registada com sucesso");
      qc.invalidateQueries({ queryKey: ["maintenance-logs"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Registar Manutenção</DialogTitle>
          <DialogDescription>
            {machine?.name} — {task?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {template.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta máquina não tem template de checklist configurado.</p>
          ) : (
            template.map((f) => (
              <div key={f.field} className="space-y-2">
                {f.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!checklistData[f.field]}
                      onCheckedChange={(v) => updateField(f.field, !!v)}
                    />
                    <Label className="cursor-pointer">{f.label}</Label>
                  </div>
                ) : f.type === "select" ? (
                  <>
                    <Label>{f.label}</Label>
                    <Select value={checklistData[f.field] || ""} onValueChange={(v) => updateField(f.field, v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {(f.options || []).map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : f.type === "number" ? (
                  <>
                    <Label>{f.label}</Label>
                    <Input type="number" value={checklistData[f.field] || ""} onChange={(e) => updateField(f.field, e.target.value)} />
                  </>
                ) : (
                  <>
                    <Label>{f.label}</Label>
                    <Input value={checklistData[f.field] || ""} onChange={(e) => updateField(f.field, e.target.value)} />
                  </>
                )}
              </div>
            ))
          )}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registar Manutenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
