import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Palmtree, Plus, Trash2, CalendarIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface DatePeriod {
  start_date: string;
  end_date: string;
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

export default function VacationPublic() {
  const { token } = useParams<{ token: string }>();
  const [vacation, setVacation] = useState<any>(null);
  const [allPeriods, setAllPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [periods, setPeriods] = useState<DatePeriod[]>([{ start_date: "", end_date: "" }]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchVacation();
  }, [token]);

  const fetchVacation = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("vacation-public", {
        body: { token, action: "get" },
      });
      if (error) throw error;
      if (data?.vacation) {
        setVacation(data.vacation);
        if (data.vacation.employee_confirmed) setSubmitted(true);
        // Load all periods for this employee
        if (data.all_periods && data.all_periods.length > 0) {
          setAllPeriods(data.all_periods);
          const existingPeriods = data.all_periods.map((p: any) => ({
            start_date: p.start_date || "",
            end_date: p.end_date || "",
          }));
          setPeriods(existingPeriods.length > 0 ? existingPeriods : [{ start_date: "", end_date: "" }]);
        } else if (data.vacation.start_date) {
          setPeriods([{ start_date: data.vacation.start_date, end_date: data.vacation.end_date }]);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addPeriod = () => setPeriods((p) => [...p, { start_date: "", end_date: "" }]);
  const removePeriod = (idx: number) => setPeriods((p) => p.filter((_, i) => i !== idx));
  const updatePeriod = (idx: number, field: keyof DatePeriod, value: string) => {
    setPeriods((p) => p.map((period, i) => i === idx ? { ...period, [field]: value } : period));
  };

  const totalDays = periods.reduce((sum, p) => sum + calcDays(p.start_date, p.end_date), 0);
  const entitled = vacation?.total_entitled_days || 22;

  const handleSuggest = async () => {
    const validPeriods = periods.filter((p) => p.start_date && p.end_date);
    if (validPeriods.length === 0) {
      toast.error("Adicione pelo menos um período com datas");
      return;
    }
    if (totalDays > entitled) {
      toast.error(`Total de dias (${totalDays}) excede os dias de direito (${entitled})`);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("vacation-public", {
        body: {
          token,
          action: "suggest",
          periods: validPeriods,
          notes,
        },
      });
      if (error) throw error;
      toast.success("Datas enviadas com sucesso!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("vacation-public", {
        body: { token, action: "accept" },
      });
      if (error) throw error;
      toast.success("Férias confirmadas!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vacation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Pedido de férias não encontrado ou link inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeeName = vacation.employees
    ? `${vacation.employees.first_name} ${vacation.employees.last_name}`
    : "Funcionário";

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palmtree className="h-6 w-6 text-primary" />
            <CardTitle className="font-display">Férias {vacation.year}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Olá {employeeName}, escolha ou confirme as suas férias.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-semibold">Férias confirmadas!</p>
              <p className="text-sm text-muted-foreground">
                As suas datas foram enviadas. O RH irá analisar e confirmar.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <p><strong>Dias de direito:</strong> {vacation.total_entitled_days}</p>
                {allPeriods.length > 0 && (
                  <div>
                    <strong>Períodos sugeridos pelo RH:</strong>
                    {allPeriods.map((p: any, i: number) => (
                      <div key={i} className="ml-2">
                        • {format(new Date(p.start_date + "T00:00:00"), "dd/MM/yyyy")} a{" "}
                        {format(new Date(p.end_date + "T00:00:00"), "dd/MM/yyyy")} ({p.days_count}d)
                      </div>
                    ))}
                  </div>
                )}
                {vacation.notes && <p><strong>Notas:</strong> {vacation.notes}</p>}
              </div>

              {vacation.admin_confirmed && allPeriods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm">O RH definiu os períodos acima. Deseja aceitar?</p>
                  <Button onClick={handleAccept} disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                    Aceitar Férias
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ou sugira os seus períodos:</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPeriod}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
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
                      <p className="text-xs text-muted-foreground">Dias úteis: <strong>{calcDays(period.start_date, period.end_date)}</strong></p>
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
                <Label>Observações (opcional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferências, motivos..." />
              </div>

              <Button onClick={handleSuggest} disabled={submitting} className="w-full">
                {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Enviar Sugestão de Férias
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
