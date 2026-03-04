import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  training?: any;
}

export default function TrainingFormDialog({ open, onClose, training }: Props) {
  const qc = useQueryClient();
  const isEdit = !!training;

  const buildForm = (t?: any) => ({
    employee_id: t?.employee_id || "",
    title: t?.title || "",
    description: t?.description || "",
    training_date: t?.training_date ? new Date(t.training_date + "T00:00:00") : new Date(),
    hours: t?.hours?.toString() || "",
    type: t?.type || "internal",
    trainer_name: t?.trainer_name || "",
    trainer_id: t?.trainer_id || "",
    location: t?.location || "",
    notes: t?.notes || "",
  });

  const [form, setForm] = useState(buildForm(training));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setForm(buildForm(training));
  }, [open, training]);

  const { data: employees } = useQuery({
    queryKey: ["employees-for-training"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!form.employee_id || !form.title || !form.hours) {
      toast.error("Preencha o funcionário, título e horas");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        title: form.title,
        description: form.description || null,
        training_date: format(form.training_date, "yyyy-MM-dd"),
        hours: parseFloat(form.hours),
        year: form.training_date.getFullYear(),
        type: form.type,
        trainer_name: form.trainer_name || null,
        trainer_id: form.trainer_id || null,
        location: form.location || null,
        notes: form.notes || null,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("employee_trainings")
          .update(payload as any)
          .eq("id", training.id);
        if (error) throw error;
        toast.success("Formação atualizada");
      } else {
        const { error } = await supabase
          .from("employee_trainings")
          .insert(payload as any);
        if (error) throw error;
        toast.success("Formação registada");
      }
      qc.invalidateQueries({ queryKey: ["trainings"] });
      qc.invalidateQueries({ queryKey: ["employee-trainings"] });
      qc.invalidateQueries({ queryKey: ["employee-profile-trainings"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Editar Formação" : "Registar Formação"}</DialogTitle>
          <DialogDescription>Registe uma formação realizada por um funcionário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
              <SelectContent>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título da Formação *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Segurança no Trabalho" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Horas *</Label>
              <Input type="number" step="0.5" min="0.5" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="8" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interna</SelectItem>
                  <SelectItem value="external">Externa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data da Formação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.training_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.training_date ? format(form.training_date, "dd/MM/yyyy") : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.training_date} onSelect={(d) => d && setForm((f) => ({ ...f, training_date: d }))} locale={pt} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Formador / Mentor</Label>
              <Input value={form.trainer_name} onChange={(e) => setForm((f) => ({ ...f, trainer_name: e.target.value }))} placeholder="Nome do formador" />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Sala 1 / Online" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição / Conteúdo</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Conteúdo abordado na formação..." />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Guardar" : "Registar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
