import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Loader2, Plus, Trash2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateBulkVacationRequests, useGetVacationPublicLink, useVacationRequests } from "@/hooks/useVacations";

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
  const { data: allVacations } = useVacationRequests(year);
  const createBulkMutation = useCreateBulkVacationRequests();
  const getLinkMutation = useGetVacationPublicLink();
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

  // Calculate already used days for selected employee
  const usedDays = employeeId
    ? (allVacations || [])
        .filter((v) => v.employee_id === employeeId && (v.status === "approved" || v.status === "pending" || v.status === "employee_suggested"))
        .reduce((sum, v) => sum + v.days_count, 0)
    : 0;
  const availableDays = entitled - usedDays;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { toast.error("Selecione um funcionário"); return; }

    const validPeriods = periods.filter((p) => p.start_date && p.end_date);
    const hasDates = validPeriods.length > 0;

    if (hasDates && totalDays > availableDays) {
      toast.error(`Total de dias (${totalDays}) excede os dias disponíveis (${availableDays}). Já existem ${usedDays} dias agendados.`);
      return;
    }

    try {
      // If no dates filled, create a placeholder record so the employee can fill in via public link
      const payloads = hasDates
        ? validPeriods.map((p) => ({
            employee_id: employeeId,
            start_date: p.start_date,
            end_date: p.end_date,
            days_count: calcDays(p.start_date, p.end_date),
            category: "individual",
            year,
            total_entitled_days: entitled,
            notes: notes || undefined,
          }))
        : [{
            employee_id: employeeId,
            start_date: `${year}-01-01`,
            end_date: `${year}-01-01`,
            days_count: 0,
            category: "individual",
            year,
            total_entitled_days: entitled,
            notes: notes || "Aguarda preenchimento pelo colaborador",
          }];

      const results = await createBulkMutation.mutateAsync(payloads);

      // Get public link for the first created request
      if (results && results.length > 0) {
        try {
          const linkData = await getLinkMutation.mutateAsync(results[0].id);
          if (linkData?.public_link) {
            await navigator.clipboard.writeText(linkData.public_link);
            toast.success(
              hasDates
                ? `${validPeriods.length} período(s) criado(s) — link copiado!`
                : "Pedido criado sem datas — link copiado!",
              {
                description: "Partilhe o link com o colaborador para preencher/confirmar as férias.",
                duration: 6000,
              }
            );
          } else {
            toast.success(hasDates ? `${validPeriods.length} período(s) criado(s)` : "Pedido criado sem datas");
          }
        } catch {
          toast.success(hasDates ? `${validPeriods.length} período(s) criado(s)` : "Pedido criado sem datas");
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
              <Label>Períodos de Férias <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addPeriod}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar Período
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para o colaborador preencher as datas pelo link público.
            </p>

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

            <div className="space-y-1 bg-muted rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Dias de direito</span>
                <span className="text-sm font-bold">{entitled}</span>
              </div>
              {employeeId && usedDays > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Já agendados</span>
                  <span className="text-sm">{usedDays}d</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Disponíveis</span>
                <span className={cn("text-sm font-bold", availableDays <= 0 ? "text-destructive" : "text-foreground")}>
                  {employeeId ? `${availableDays}d` : `${entitled}d`}
                </span>
              </div>
              {totalDays > 0 && (
                <div className="flex items-center justify-between border-t pt-1 mt-1">
                  <span className="text-sm font-medium">Este pedido</span>
                  <span className={cn("text-sm font-bold", totalDays > availableDays ? "text-destructive" : "text-foreground")}>
                    {totalDays}d
                  </span>
                </div>
              )}
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
              <Link2 className="mr-2 h-4 w-4" />
              Criar e Copiar Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
