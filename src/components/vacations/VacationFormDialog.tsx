import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateVacationRequest, useSendVacationEmail } from "@/hooks/useVacations";

interface Props {
  open: boolean;
  onClose: () => void;
  year: number;
}

export function VacationFormDialog({ open, onClose, year }: Props) {
  const { data: employees } = useEmployees("");
  const createMutation = useCreateVacationRequest();
  const sendEmailMutation = useSendVacationEmail();
  const loading = createMutation.isPending;

  const [form, setForm] = useState({
    employee_id: "",
    start_date: "",
    end_date: "",
    total_entitled_days: "22",
    notes: "",
    category: "individual",
  });

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    let count = 0;
    const d = new Date(s);
    while (d <= e) {
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error("Selecione um funcionário");
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast.error("Preencha as datas");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        employee_id: form.employee_id,
        start_date: form.start_date,
        end_date: form.end_date,
        days_count: calcDays(form.start_date, form.end_date),
        category: form.category,
        year,
        total_entitled_days: parseInt(form.total_entitled_days) || 22,
        notes: form.notes || undefined,
      });

      // Send email to employee
      if (form.category === "individual" && result?.id) {
        try {
          await sendEmailMutation.mutateAsync(result.id);
          toast.success("Férias criadas e e-mail enviado ao funcionário");
        } catch {
          toast.success("Férias criadas (falha ao enviar e-mail)");
        }
      } else {
        toast.success("Férias registadas");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar férias");
    }
  };

  const activeEmployees = (employees || []).filter((e) => e.status === "active");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Novo Pedido de Férias</DialogTitle>
          <DialogDescription>Crie um pedido de férias individual para um funcionário</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm((p) => ({ ...p, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual (combinado)</SelectItem>
                <SelectItem value="factory">Fábrica (coletivo)</SelectItem>
                <SelectItem value="warehouse">Armazém (coletivo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.start_date ? format(new Date(form.start_date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.start_date ? new Date(form.start_date + "T00:00:00") : undefined}
                    onSelect={(d) => setForm((p) => ({ ...p, start_date: d ? format(d, "yyyy-MM-dd") : "" }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.end_date ? format(new Date(form.end_date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.end_date ? new Date(form.end_date + "T00:00:00") : undefined}
                    onSelect={(d) => setForm((p) => ({ ...p, end_date: d ? format(d, "yyyy-MM-dd") : "" }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {form.start_date && form.end_date && (
            <p className="text-sm text-muted-foreground">
              Dias úteis: <strong>{calcDays(form.start_date, form.end_date)}</strong>
            </p>
          )}

          <div className="space-y-2">
            <Label>Dias de Direito (ano)</Label>
            <Input
              type="number"
              min="0"
              value={form.total_entitled_days}
              onChange={(e) => setForm((p) => ({ ...p, total_entitled_days: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notas adicionais..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              <Send className="mr-2 h-4 w-4" />
              Criar e Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
