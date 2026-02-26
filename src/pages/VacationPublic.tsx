import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Palmtree } from "lucide-react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function VacationPublic() {
  const { token } = useParams<{ token: string }>();
  const [vacation, setVacation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
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
        if (data.vacation.start_date) setStartDate(new Date(data.vacation.start_date + "T00:00:00"));
        if (data.vacation.end_date) setEndDate(new Date(data.vacation.end_date + "T00:00:00"));
        if (data.vacation.employee_confirmed) setSubmitted(true);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = async () => {
    if (!startDate || !endDate) {
      toast.error("Selecione as datas de início e fim");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("vacation-public", {
        body: {
          token,
          action: "suggest",
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
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
              {vacation.start_date && vacation.end_date && (
                <div className="flex justify-center gap-2">
                  <Badge variant="outline">
                    {format(new Date(vacation.start_date + "T00:00:00"), "dd/MM/yyyy")} - {format(new Date(vacation.end_date + "T00:00:00"), "dd/MM/yyyy")}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <p><strong>Dias de direito:</strong> {vacation.total_entitled_days}</p>
                {vacation.start_date && vacation.end_date && (
                  <p>
                    <strong>Período sugerido pelo RH:</strong>{" "}
                    {format(new Date(vacation.start_date + "T00:00:00"), "dd/MM/yyyy")} a{" "}
                    {format(new Date(vacation.end_date + "T00:00:00"), "dd/MM/yyyy")}
                  </p>
                )}
                {vacation.notes && <p><strong>Notas:</strong> {vacation.notes}</p>}
              </div>

              {vacation.admin_confirmed && vacation.start_date && (
                <div className="space-y-2">
                  <p className="text-sm">O RH definiu as datas acima. Deseja aceitar?</p>
                  <Button onClick={handleAccept} disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                    Aceitar Férias
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label>Ou sugira as suas datas:</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      className="rounded-md border pointer-events-auto"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      className="rounded-md border pointer-events-auto"
                    />
                  </div>
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
