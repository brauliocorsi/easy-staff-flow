import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MeetingTimer } from "@/components/meetings/MeetingTimer";
import { ParticipantsList } from "@/components/meetings/ParticipantsList";
import { AgendaCard } from "@/components/meetings/AgendaCard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PublicMeetingData {
  title: string;
  description: string | null;
  meeting_date: string;
  duration_minutes: number | null;
  started_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  status: string;
  participants: {
    id: string;
    employee_id: string;
    present?: boolean;
    employees: { first_name: string; last_name: string; position: string; email: string } | null;
  }[];
  agendas: {
    id: string;
    title: string;
    description: string | null;
    decision: string | null;
    sort_order: number;
    meeting_id: string;
    created_at: string;
    responsible_employee_id?: string | null;
  }[];
}

export default function MeetingPublic() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicMeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("meeting-public", {
        body: { meeting_id: id },
      });
      if (fnError) throw fnError;
      setData(result);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar reunião");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Poll every 5 seconds to keep in sync (realtime requires auth which public page doesn't have)
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{error ?? "Reunião não encontrada."}</p>
      </div>
    );
  }

  const isPaused = !!data.paused_at;
  const statusLabel = data.status === "completed"
    ? "Concretizada"
    : isPaused
      ? "Pausada"
      : data.status === "in_progress"
        ? "Em Andamento"
        : "Agendada";

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Badge variant={isPaused ? "destructive" : "outline"}>{statusLabel}</Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight">{data.title}</h1>
          {data.description && (
            <p className="text-muted-foreground text-lg">{data.description}</p>
          )}
        </div>

        {/* Timer */}
        <div className="flex justify-center">
          <MeetingTimer durationMinutes={data.duration_minutes} startedAt={data.started_at} pausedAt={data.paused_at} pausedSeconds={data.paused_seconds ?? 0} status={data.status} large />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agendas */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="font-display text-xl font-semibold">Pautas</h2>
            {data.agendas.length > 0 ? (
              data.agendas.map((a, i) => (
                <AgendaCard key={a.id} agenda={a} index={i} />
              ))
            ) : (
              <Card>
                <CardContent className="p-4 text-muted-foreground text-sm">
                  Nenhuma pauta registrada ainda.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Participants */}
          <div>
            <h2 className="font-display text-xl font-semibold mb-4">Participantes</h2>
            <Card>
              <CardContent className="p-4">
                <ParticipantsList participants={data.participants} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
