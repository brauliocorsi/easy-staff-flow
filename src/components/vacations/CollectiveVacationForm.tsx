import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVacationSettings, useUpsertVacationSettings, useCreateBulkVacationRequests } from "@/hooks/useVacations";
import { useEmployees } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  year: number;
  category: "factory" | "warehouse";
  title: string;
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
  const upsertMutation = useUpsertVacationSettings();
  const createBulkMutation = useCreateBulkVacationRequests();

  const existing = settings?.find((s) => s.category === category);

  const [startDate, setStartDate] = useState(existing?.start_date || "");
  const [endDate, setEndDate] = useState(existing?.end_date || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  if (existing && !startDate && existing.start_date) {
    setStartDate(existing.start_date);
    setEndDate(existing.end_date);
    setNotes(existing.notes || "");
  }

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast.error("Preencha as datas de início e fim");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        year,
        category,
        start_date: startDate,
        end_date: endDate,
        notes: notes || undefined,
      });

      // Create individual vacation_request for each active employee (avoid duplicates)
      const activeEmployees = (employees || []).filter((e) => e.status === "active");
      if (activeEmployees.length > 0) {
        // Check existing collective requests for this year/category
        const { data: existingRequests } = await supabase
          .from("vacation_requests")
          .select("employee_id")
          .eq("year", year)
          .eq("category", category)
          .eq("start_date", startDate)
          .eq("end_date", endDate);

        const existingIds = new Set((existingRequests || []).map((r) => r.employee_id));
        const days = calcDays(startDate, endDate);

        const newPayloads = activeEmployees
          .filter((e) => !existingIds.has(e.id))
          .map((e) => ({
            employee_id: e.id,
            start_date: startDate,
            end_date: endDate,
            days_count: days,
            category,
            year,
            total_entitled_days: 22,
            notes: notes || undefined,
          }));

        if (newPayloads.length > 0) {
          await createBulkMutation.mutateAsync(newPayloads);
          toast.success(`Período guardado e ${newPayloads.length} registos criados para funcionários`);
        } else {
          toast.success(`Período de férias de ${title} guardado (registos já existiam)`);
        }
      } else {
        toast.success(`Período de férias de ${title} guardado`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao guardar");
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
          Defina o período coletivo de férias. Aplica-se a todos os funcionários ativos — será criado um registo individual para cada.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(new Date(startDate + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate ? new Date(startDate + "T00:00:00") : undefined}
                  onSelect={(d) => setStartDate(d ? format(d, "yyyy-MM-dd") : "")}
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
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(new Date(endDate + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate ? new Date(endDate + "T00:00:00") : undefined}
                  onSelect={(d) => setEndDate(d ? format(d, "yyyy-MM-dd") : "")}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {startDate && endDate && (
          <p className="text-sm text-muted-foreground">
            Dias úteis: <strong>{calcDays(startDate, endDate)}</strong>
          </p>
        )}

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." />
        </div>

        <Button onClick={handleSave} disabled={upsertMutation.isPending || createBulkMutation.isPending}>
          {(upsertMutation.isPending || createBulkMutation.isPending) ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar e Registar para Funcionários
        </Button>
      </CardContent>
    </Card>
  );
}
