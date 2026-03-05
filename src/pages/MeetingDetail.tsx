import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, CheckCircle, Play, Pause, PlayCircle, FileDown, UserPlus, X } from "lucide-react";
import { generateMeetingPdf } from "@/lib/generateMeetingPdf";
import { useMeeting, useMeetingAgendas, useAddAgenda, useUpdateAgenda, useFinalizeMeeting, useStartMeeting, useToggleParticipantPresence, usePauseMeeting, useResumeMeeting } from "@/hooks/useMeetings";
import { MeetingTimer } from "@/components/meetings/MeetingTimer";
import { AgendaCard } from "@/components/meetings/AgendaCard";
import { AgendaInput } from "@/components/meetings/AgendaInput";
import { ParticipantsList } from "@/components/meetings/ParticipantsList";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployees } from "@/hooks/useEmployees";
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
  const startMeeting = useStartMeeting();
  const pauseMeeting = usePauseMeeting();
  const resumeMeeting = useResumeMeeting();
  const togglePresence = useToggleParticipantPresence();

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

  const handleUpdateDecision = (agendaId: string, decision: string, responsibleEmployeeIds: string[] = []) => {
    updateAgenda.mutate({
      id: agendaId,
      decision,
      responsible_employee_id: responsibleEmployeeIds.length === 1 ? responsibleEmployeeIds[0] : null,
      responsibleEmployeeIds,
    } as any);
  };

  const handleStart = async () => {
    if (!id) return;
    try {
      await startMeeting.mutateAsync(id);
      toast({ title: "Reunião iniciada!", description: "O cronómetro está a correr." });
    } catch (err: any) {
      toast({ title: "Erro ao iniciar", description: err.message, variant: "destructive" });
    }
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

  const handlePause = async () => {
    if (!id) return;
    try {
      await pauseMeeting.mutateAsync(id);
      toast({ title: "Reunião pausada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleResume = async () => {
    if (!id || !meeting) return;
    try {
      await resumeMeeting.mutateAsync({
        meetingId: id,
        pausedAt: (meeting as any).paused_at,
        currentPausedSeconds: (meeting as any).paused_seconds ?? 0,
      });
      toast({ title: "Reunião retomada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleTogglePresence = (participantId: string, present: boolean) => {
    togglePresence.mutate({ participantId, present });
  };

  const { data: allEmployees } = useEmployees("");

  const handleAddParticipant = async (employeeId: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .insert({ meeting_id: id, employee_id: employeeId });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["meeting", id] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .delete()
        .eq("id", participantId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["meeting", id] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadPdf = () => {
    if (!meeting || !agendas) return;
    generateMeetingPdf({
      title: meeting.title,
      description: meeting.description,
      meeting_date: meeting.meeting_date,
      duration_minutes: meeting.duration_minutes,
      started_at: (meeting as any).started_at,
      status: meeting.status,
      agendas: agendas.map((a) => ({
        title: a.title,
        description: a.description,
        decision: a.decision,
        sort_order: a.sort_order,
      })),
      participants: participants.map((p: any) => ({
        employees: p.employees,
        present: p.present,
      })),
    });
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
  const isScheduled = meeting.status === "scheduled";
  const isInProgress = meeting.status === "in_progress";
  const isPaused = !!(meeting as any).paused_at;

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
              <Badge variant={isPaused ? "destructive" : status.variant}>
                {isPaused ? "Pausada" : status.label}
              </Badge>
            </div>
            {(meeting as any).meeting_type && (
              <p className="text-sm font-medium text-primary">{(meeting as any).meeting_type}</p>
            )}
            {meeting.description && (
              <p className="text-muted-foreground">{meeting.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {format(new Date(meeting.meeting_date), "dd MMM yyyy", { locale: pt })}
              {(meeting as any).scheduled_time && ` · ${(meeting as any).scheduled_time.slice(0, 5)}`}
              {meeting.duration_minutes && ` · ${meeting.duration_minutes} minutos`}
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
            {isScheduled && (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={startMeeting.isPending}
              >
                <Play className="h-4 w-4 mr-1" /> Iniciar Reunião
              </Button>
            )}
            {isInProgress && !isPaused && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={pauseMeeting.isPending}
              >
                <Pause className="h-4 w-4 mr-1" /> Pausar
              </Button>
            )}
            {isInProgress && isPaused && (
              <Button
                size="sm"
                onClick={handleResume}
                disabled={resumeMeeting.isPending}
              >
                <PlayCircle className="h-4 w-4 mr-1" /> Retomar
              </Button>
            )}
            {isInProgress && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFinalize}
                disabled={finalizeMeeting.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Finalizar Reunião
              </Button>
            )}
            {isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
              >
                <FileDown className="h-4 w-4 mr-1" /> Baixar Ata (PDF)
              </Button>
            )}
          </div>
        </div>

        {/* Timer */}
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <MeetingTimer
              durationMinutes={meeting.duration_minutes}
              startedAt={(meeting as any).started_at}
              pausedAt={(meeting as any).paused_at}
              pausedSeconds={(meeting as any).paused_seconds ?? 0}
              status={meeting.status}
            />
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
                      participants={participants}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-base">Participantes</CardTitle>
              {isScheduled && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2" align="end">
                    {allEmployees
                      ?.filter((e) => !participants.some((p: any) => p.employee_id === e.id))
                      .map((e) => (
                        <button
                          key={e.id}
                          onClick={() => handleAddParticipant(e.id)}
                          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {e.first_name[0]}{e.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          {e.first_name} {e.last_name}
                        </button>
                      ))}
                    {allEmployees?.filter((e) => !participants.some((p: any) => p.employee_id === e.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Todos já adicionados</p>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </CardHeader>
            <CardContent>
              {participants.length > 0 ? (
                isScheduled ? (
                  <div className="space-y-2">
                    {participants.map((p: any) => {
                      const emp = p.employees;
                      if (!emp) return null;
                      return (
                        <div key={p.employee_id} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm flex-1">
                            <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                            <p className="text-muted-foreground text-xs">{emp.position} · {emp.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveParticipant(p.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ParticipantsList
                    participants={participants}
                    showEmail
                    editable={!isCompleted}
                    onTogglePresence={handleTogglePresence}
                  />
                )
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
