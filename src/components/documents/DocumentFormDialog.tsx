import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DOC_TYPES = [
  { value: "contract", label: "Contrato" },
  { value: "id", label: "Documento de Identidade" },
  { value: "certificate", label: "Certificado" },
  { value: "medical", label: "Atestado Médico" },
  { value: "training", label: "Formação" },
  { value: "other", label: "Outro" },
];

export function DocumentFormDialog({ open, onClose }: Props) {
  const { data: employees } = useEmployees("");
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    employee_id: "",
    name: "",
    type: "other",
    notes: "",
    expiry_date: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Selecione o funcionário");
    if (!form.name.trim()) return toast.error("Informe o nome do documento");

    setSaving(true);
    try {
      let fileUrl: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${form.employee_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file);
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("documents").insert({
        employee_id: form.employee_id,
        name: form.name.trim(),
        type: form.type,
        notes: form.notes || null,
        expiry_date: form.expiry_date || null,
        file_url: fileUrl,
      });
      if (error) throw error;

      toast.success("Documento adicionado!");
      qc.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar documento");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = (employees || []).filter((e) => e.status === "active");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar Documento</DialogTitle>
          <DialogDescription>Vincule um documento a um funcionário</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <Select value={form.employee_id || "placeholder"} onValueChange={(v) => handleChange("employee_id", v === "placeholder" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder" disabled>Selecione o funcionário</SelectItem>
                {activeEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc_name">Nome do Documento *</Label>
            <Input id="doc_name" placeholder="Ex: Contrato CLT 2025" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => handleChange("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">Data de Validade</Label>
              <Input id="expiry" type="date" value={form.expiry_date} onChange={(e) => handleChange("expiry_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Ficheiro (opcional)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("doc-file")?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Selecionar Ficheiro
              </Button>
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {file ? file.name : "Nenhum ficheiro selecionado"}
              </span>
            </div>
            <input
              id="doc-file"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}