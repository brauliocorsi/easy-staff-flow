import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVacationSettings, useCreateBulkVacationRequests } from "@/hooks/useVacations";
import { useEmployees } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  year: number;
  category: "factory" | "warehouse";
  title: string;
}

interface PeriodEntry {
  id?: string; // DB id if exists
  label: string;
  start_date: string;
  end_date: string;
  notes: string;
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

export function CollectiveVacationForm({ year, category, title }: Props) {
  const { data: settings, isLoading } = useVacationSettings(year);
  const { data: employees } = useEmployees("");
  const createBulkMutation = useCreateBulkVacationRequests();

  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load existing settings into periods
  useEffect(() => {
    if (settings && !initialized) {
      const existing = settings.filter((s) => s.category === category);
      if (existing.length > 0) {
        setPeriods(
          existing.map((s) => ({
            id: s.id,
            label: (s as any).label || "",
            start_date: s.start_date,
            end_date: s.end_date,
            notes: s.notes || "",
          }))
        );
      } else {
        setPeriods([{ label: "", start_date: "", end_date: "", notes: "" }]);
      }
      setInitialized(true);
    }
  }, [settings, category, initialized]);

  // Reset when year changes
  useEffect(() => {
    setInitialized(false);
  }, [year]);

  const addPeriod = () => {
    setPeriods((prev) => [...prev, { label: "", start_date: "", end_date: "", notes: "" }]);
  };

  const removePeriod = (index: number) => {
    setPeriods((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePeriod = (index: number, field: keyof PeriodEntry, value: string) => {
    setPeriods((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const totalDays = periods.reduce((sum, p) => sum + calcDays(p.start_date, p.end_date), 0);

  const handleSave = async () => {
    const validPeriods = periods.filter((p) => p.start_date && p.end_date);
    if (validPeriods.length === 0) {
      toast.error("Adicione pelo menos um período com datas válidas");
      return;
    }

    setSaving(true);
    try {
      // Delete old settings for this year/category
      await supabase
        .from("vacation_settings")
        .delete()
        .eq("year", year)
        .eq("category", category);

      // Insert all periods
      const settingsPayloads = validPeriods.map((p) => ({
        year,
        category,
        start_date: p.start_date,
        end_date: p.end_date,
        notes: p.notes || null,
        label: p.label || null,
      }));

      const { error: settingsErr } = await supabase
        .from("vacation_settings")
        .insert(settingsPayloads);
      if (settingsErr) throw settingsErr;

      // Delete old collective vacation_requests for this year/category
      await supabase
        .from("vacation_requests")
        .delete()
        .eq("year", year)
        .eq("category", category);

      // Create individual vacation_request for each active employee per period
      const activeEmployees = (employees || []).filter((e) => e.status === "active");
      if (activeEmployees.length > 0) {
        const allPayloads = validPeriods.flatMap((p) => {
          const days = calcDays(p.start_date, p.end_date);
          return activeEmployees.map((e) => ({
            employee_id: e.id,
            start_date: p.start_date,
            end_date: p.end_date,
            days_count: days,
            category,
            year,
            total_entitled_days: 22,
            notes: p.label ? `${p.label}${p.notes ? ` — ${p.notes}` : ""}` : p.notes || undefined,
          }));
        });

        if (allPayloads.length > 0) {
          await createBulkMutation.mutateAsync(allPayloads);
        }
        toast.success(
          `${validPeriods.length} período(s) guardado(s) — ${allPayloads.length} registos criados (${totalDays} dias úteis)`
        );
      } else {
        toast.success(`${validPeriods.length} período(s) de férias guardado(s)`);
      }

      setInitialized(false); // Refresh from DB
    } catch (err: any) {
      toast.error(err.message || "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="py-4 text-center text-sm text-muted-foreground">A carregar...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{title} — {year}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Defina os períodos coletivos de férias. Pode adicionar vários períodos ao longo do ano. Aplica-se a todos os funcionários ativos.
        </p>

        <div className="space-y-4">
          {periods.map((period, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Período {index + 1}</span>
                {periods.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePeriod(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Descrição (ex: Agosto, Natal...)</Label>
                <Input
                  value={period.label}
                  onChange={(e) => updatePeriod(index, "label", e.target.value)}
                  placeholder="Ex: Férias de Agosto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !period.start_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {period.start_date ? format(new Date(period.start_date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={period.start_date ? new Date(period.start_date + "T00:00:00") : undefined}
                        onSelect={(d) => updatePeriod(index, "start_date", d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !period.end_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {period.end_date ? format(new Date(period.end_date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={period.end_date ? new Date(period.end_date + "T00:00:00") : undefined}
                        onSelect={(d) => updatePeriod(index, "end_date", d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {period.start_date && period.end_date && (
                <p className="text-sm text-muted-foreground">
                  Dias úteis: <strong>{calcDays(period.start_date, period.end_date)}</strong>
                </p>
              )}

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={period.notes} onChange={(e) => updatePeriod(index, "notes", e.target.value)} placeholder="Notas..." rows={2} />
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={addPeriod} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar Período
        </Button>

        {totalDays > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <strong>Total: {totalDays} dias úteis</strong> em {periods.filter((p) => p.start_date && p.end_date).length} período(s)
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar e Registar para Funcionários
        </Button>
      </CardContent>
    </Card>
  );
}
