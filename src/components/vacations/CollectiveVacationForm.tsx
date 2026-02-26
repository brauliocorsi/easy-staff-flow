import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVacationSettings, useUpsertVacationSettings } from "@/hooks/useVacations";

interface Props {
  year: number;
  category: "factory" | "warehouse";
  title: string;
}

export function CollectiveVacationForm({ year, category, title }: Props) {
  const { data: settings, isLoading } = useVacationSettings(year);
  const upsertMutation = useUpsertVacationSettings();

  const existing = settings?.find((s) => s.category === category);

  const [startDate, setStartDate] = useState(existing?.start_date || "");
  const [endDate, setEndDate] = useState(existing?.end_date || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  // Update local state when data loads
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
      toast.success(`Período de férias de ${title} guardado`);
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
          Defina o período coletivo de férias. Aplica-se a todos os funcionários desta categoria.
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

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." />
        </div>

        <Button onClick={handleSave} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar Período
        </Button>
      </CardContent>
    </Card>
  );
}
