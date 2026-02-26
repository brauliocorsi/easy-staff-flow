import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, CheckCircle } from "lucide-react";
import { useMeeting, useMeetingAgendas, useAddAgenda, useUpdateAgenda, useFinalizeMeeting } from "@/hooks/useMeetings";
import { MeetingTimer } from "@/components/meetings/MeetingTimer";
import { AgendaCard } from "@/components/meetings/AgendaCard";
import { AgendaInput } from "@/components/meetings/AgendaInput";
import { ParticipantsList } from "@/components/meetings/ParticipantsList";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  scheduled: { label: "Agendada", variant: "secondary" },
  in_progress: { label: "Em Andamento", variant: "default" },
  completed: { label: "Concretizada", variant: "outline" },
};

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useMeeting(id);
  const { data: agendas } = useMeetingAgendas(id);
  const addAgenda = useAddAgenda();
  const updateAgenda = useUpdateAgenda();
  const finalizeMeeting = useFinalizeMeeting();

  // Realtime subscription for agendas
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`agendas-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_agendas", filter: `meeting_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["meeting_agendas", id] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  const handleAddAgenda = (title: string, description: string) => {
    if (!id) return;
    const sortOrder = (agendas?.length ?? 0) + 1;
    addAgenda.mutate({ meeting_id: id, title, description: description || null, sort_order: sortOrder });
  };

  const handleUpdateDecision = (agendaId: string, decision: string) => {
    updateAgenda.mutate({ id: agendaId, decision });
  };

  const handleFinalize = async () => {
    if (!id) return;
    try {
      await finalizeMeeting.mutateAsync(id);
      toast({ title: "Reunião finalizada!", description: "Ata enviada por email aos participantes." });
    } catch (err: any) {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Carregando...</p>
      </AppLayout>
    );
  }

  if (!meeting) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Reunião não encontrada.</p>
      </AppLayout>
    );
  }

  const status = statusMap[meeting.status] ?? statusMap.scheduled;
  const participants = (meeting as any).meeting_participants ?? [];
  const isCompleted = meeting.status === "completed";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/reunioes")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight">{meeting.title}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            {meeting.description && (
              <p className="text-muted-foreground">{meeting.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {format(new Date(meeting.meeting_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
              {(meeting as any).end_time &&
                ` — ${format(new Date((meeting as any).end_time), "HH:mm")}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/reuniao-publica/${id}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Página Pública
            </Button>
            {!isCompleted && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFinalize}
                disabled={finalizeMeeting.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Finalizar Reunião
              </Button>
            )}
          </div>
        </div>

        {/* Timer */}
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <MeetingTimer endTime={(meeting as any).end_time} status={meeting.status} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agendas */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Pautas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isCompleted && (
                  <>
                    <AgendaInput onAdd={handleAddAgenda} loading={addAgenda.isPending} />
                    <Separator />
                  </>
                )}
                {agendas && agendas.length > 0 ? (
                  agendas.map((a, i) => (
                    <AgendaCard
                      key={a.id}
                      agenda={a}
                      index={i}
                      editable={!isCompleted}
                      onUpdateDecision={handleUpdateDecision}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma pauta adicionada.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Participantes</CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length > 0 ? (
                <ParticipantsList participants={participants} showEmail />
              ) : (
                <p className="text-sm text-muted-foreground">Sem participantes.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
