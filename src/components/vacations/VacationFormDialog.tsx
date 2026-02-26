import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Loader2, Send, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateBulkVacationRequests, useSendVacationEmail } from "@/hooks/useVacations";

interface DatePeriod {
  start_date: string;
  end_date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  year: number;
}

function calcDays(start: string, end: string): number {
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
}

export function VacationFormDialog({ open, onClose, year }: Props) {
  const { data: employees } = useEmployees("");
  const createBulkMutation = useCreateBulkVacationRequests();
  const sendEmailMutation = useSendVacationEmail();
  const loading = createBulkMutation.isPending;

  const [employeeId, setEmployeeId] = useState("");
  const [totalEntitledDays, setTotalEntitledDays] = useState("22");
  const [notes, setNotes] = useState("");
  const [periods, setPeriods] = useState<DatePeriod[]>([{ start_date: "", end_date: "" }]);

  const addPeriod = () => setPeriods((p) => [...p, { start_date: "", end_date: "" }]);
  const removePeriod = (idx: number) => setPeriods((p) => p.filter((_, i) => i !== idx));
  const updatePeriod = (idx: number, field: keyof DatePeriod, value: string) => {
    setPeriods((p) => p.map((period, i) => i === idx ? { ...period, [field]: value } : period));
  };

  const totalDays = periods.reduce((sum, p) => sum + calcDays(p.start_date, p.end_date), 0);
  const entitled = parseInt(totalEntitledDays) || 22;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { toast.error("Selecione um funcionário"); return; }

    const validPeriods = periods.filter((p) => p.start_date && p.end_date);
    if (validPeriods.length === 0) { toast.error("Adicione pelo menos um período com datas"); return; }

    if (totalDays > entitled) {
      toast.error(`Total de dias (${totalDays}) excede os dias de direito (${entitled})`);
      return;
    }

    try {
      const payloads = validPeriods.map((p) => ({
        employee_id: employeeId,
        start_date: p.start_date,
        end_date: p.end_date,
        days_count: calcDays(p.start_date, p.end_date),
        category: "individual",
        year,
        total_entitled_days: entitled,
        notes: notes || undefined,
      }));

      const results = await createBulkMutation.mutateAsync(payloads);

      // Send email for first created request
      if (results && results.length > 0) {
        try {
          await sendEmailMutation.mutateAsync(results[0].id);
          toast.success(`${validPeriods.length} período(s) criado(s) e e-mail enviado`);
        } catch {
          toast.success(`${validPeriods.length} período(s) criado(s) (falha ao enviar e-mail)`);
        }
      }

      // Reset form
      setEmployeeId("");
      setTotalEntitledDays("22");
      setNotes("");
      setPeriods([{ start_date: "", end_date: "" }]);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar férias");
    }
  };

  const activeEmployees = (employees || []).filter((e) => e.status === "active");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Novo Pedido de Férias</DialogTitle>
          <DialogDescription>Adicione múltiplos períodos de férias para o funcionário</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dias de Direito (ano)</Label>
            <Input
              type="number"
              min="0"
              value={totalEntitledDays}
              onChange={(e) => setTotalEntitledDays(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Períodos de Férias</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPeriod}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar Período
              </Button>
            </div>

            {periods.map((period, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Período {idx + 1}</span>
                  {periods.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePeriod(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !period.start_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {period.start_date ? format(new Date(period.start_date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={period.start_date ? new Date(period.start_date + "T00:00:00") : undefined}
                          onSelect={(d) => updatePeriod(idx, "start_date", d ? format(d, "yyyy-MM-dd") : "")}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !period.end_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {period.end_date ? format(new Date(period.end_date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={period.end_date ? new Date(period.end_date + "T00:00:00") : undefined}
                          onSelect={(d) => updatePeriod(idx, "end_date", d ? format(d, "yyyy-MM-dd") : "")}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {period.start_date && period.end_date && (
                  <p className="text-xs text-muted-foreground">
                    Dias úteis: <strong>{calcDays(period.start_date, period.end_date)}</strong>
                  </p>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between bg-muted rounded-lg p-3">
              <span className="text-sm font-medium">Total de dias</span>
              <span className={cn("text-sm font-bold", totalDays > entitled ? "text-destructive" : "text-foreground")}>
                {totalDays} / {entitled}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." />
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
