import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateWarning } from "@/hooks/useWarnings";
import { generateWarningPdf } from "@/lib/generateWarningPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const WARNING_TYPES = [
  { value: "verbal", label: "Verbal" },
  { value: "written", label: "Escrita" },
  { value: "suspension", label: "Suspensão" },
  { value: "termination", label: "Demissão por Justa Causa" },
];

export function WarningFormDialog({ open, onClose }: Props) {
  const { data: employees } = useEmployees("");
  const createMutation = useCreateWarning();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    type: "verbal",
    reason: "",
    description: "",
    warning_date: new Date().toISOString().split("T")[0],
    suspension_start: "",
    suspension_end: "",
  });

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  const handleSubmit = async () => {
    if (!form.employee_id || !form.reason) {
      toast.error("Preencha funcionário e motivo.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Get issued_by employee id
      let issuedBy: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        issuedBy = profile?.id || null;
      }

      const warning = await createMutation.mutateAsync({
        employee_id: form.employee_id,
        type: form.type,
        reason: form.reason,
        description: form.description || null,
        warning_date: form.warning_date,
        issued_by: issuedBy,
      });

      // Generate PDF for non-verbal
      if (form.type !== "verbal") {
        const emp = activeEmployees.find((e) => e.id === form.employee_id);
        if (emp) {
          generateWarningPdf({
            employeeName: `${emp.first_name} ${emp.last_name}`,
            employeePosition: emp.position,
            employeeDepartment: (emp as any).departments?.name || "",
            type: form.type,
            reason: form.reason,
            description: form.description || null,
            warningDate: form.warning_date,
            suspensionStart: form.type === "suspension" ? form.suspension_start : null,
            suspensionEnd: form.type === "suspension" ? form.suspension_end : null,
          });
        }
      }

      // Send email notification
      try {
        await supabase.functions.invoke("send-warning-email", {
          body: { warning_id: warning.id },
        });
      } catch {
        console.error("Failed to send warning email");
      }

      toast.success("Advertência registrada com sucesso!");
      setForm({
        employee_id: "",
        type: "verbal",
        reason: "",
        description: "",
        warning_date: new Date().toISOString().split("T")[0],
        suspension_start: "",
        suspension_end: "",
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar advertência");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Advertência</DialogTitle>
          <DialogDescription>Preencha os dados da advertência disciplinar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo *</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WARNING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Motivo *</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Motivo da advertência"
            />
          </div>

          <div>
            <Label>Descrição detalhada</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva os detalhes da advertência..."
              rows={4}
            />
          </div>

          <div>
            <Label>Data da advertência</Label>
            <Input
              type="date"
              value={form.warning_date}
              onChange={(e) => setForm({ ...form, warning_date: e.target.value })}
            />
          </div>

          {form.type === "suspension" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início da suspensão</Label>
                <Input
                  type="date"
                  value={form.suspension_start}
                  onChange={(e) => setForm({ ...form, suspension_start: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim da suspensão</Label>
                <Input
                  type="date"
                  value={form.suspension_end}
                  onChange={(e) => setForm({ ...form, suspension_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
