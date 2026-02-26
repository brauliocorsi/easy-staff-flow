import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, Users, ExternalLink, Pencil, User, CalendarCheck2, Play, CheckCircle2 } from "lucide-react";
import { useMeetings } from "@/hooks/useMeetings";
import { MeetingFormDialog } from "@/components/meetings/MeetingFormDialog";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

const statusConfig: Record<string, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: typeof CalendarCheck2;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  scheduled: {
    label: "Agendada",
    variant: "secondary",
    icon: CalendarCheck2,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-l-blue-500",
  },
  in_progress: {
    label: "Em Andamento",
    variant: "default",
    icon: Play,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-l-amber-500",
  },
  completed: {
    label: "Concretizada",
    variant: "outline",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-l-emerald-500",
  },
};

export default function Meetings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const { data: meetings, isLoading } = useMeetings();
  const navigate = useNavigate();

  const handleEdit = (meeting: any) => {
    setEditingMeeting(meeting);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMeeting(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Reuniões</h1>
            <p className="text-muted-foreground mt-1">Agende e gerencie reuniões com pautas</p>
          </div>
          <Button onClick={() => { setEditingMeeting(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Reunião
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !meetings?.length ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma reunião agendada.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {meetings.map((m) => {
              const cfg = statusConfig[m.status] ?? statusConfig.scheduled;
              const StatusIcon = cfg.icon;
              const participantCount = (m as any).meeting_participants?.length ?? 0;
              const isCompleted = m.status === "completed";
              const isInProgress = m.status === "in_progress";
              const createdByEmp = (m as any).created_by_employee;
              const responsibleName = createdByEmp
                ? `${createdByEmp.first_name} ${createdByEmp.last_name}`
                : null;

              const scheduledTime = (m as any).scheduled_time
                ? (m as any).scheduled_time.slice(0, 5)
                : format(new Date(m.meeting_date), "HH:mm");
              const startedTime = (m as any).started_at
                ? format(new Date((m as any).started_at), "HH:mm")
                : null;
              const endedTime = (m as any).end_time
                ? format(new Date((m as any).end_time), "HH:mm")
                : null;

              return (
                <Card
                  key={m.id}
                  className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${cfg.borderColor} ${isInProgress ? "ring-1 ring-amber-300/50 dark:ring-amber-600/30" : ""}`}
                  onClick={() => navigate(`/reunioes/${m.id}`)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    {/* Status icon */}
                    <div className={`shrink-0 flex items-center justify-center h-12 w-12 rounded-xl ${cfg.bgColor}`}>
                      <StatusIcon className={`h-6 w-6 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display font-semibold text-lg truncate">{m.title}</h3>
                        <Badge variant={cfg.variant} className="shrink-0">
                          {cfg.label}
                        </Badge>
                        {isInProgress && (
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                          </span>
                        )}
                      </div>
                      {responsibleName && (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                          <User className="h-3.5 w-3.5" />
                          Responsável: {responsibleName}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(m.meeting_date), "dd MMM yyyy", { locale: pt })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {startedTime
                            ? `${startedTime}${endedTime ? ` – ${endedTime}` : " (em curso)"}`
                            : `Agendada: ${scheduledTime}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {participantCount} participante(s)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      {!isCompleted && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(m);
                          }}
                          title="Editar reunião"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/reuniao-publica/${m.id}`, "_blank");
                        }}
                        title="Abrir página pública"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <MeetingFormDialog open={dialogOpen} onClose={handleCloseDialog} meeting={editingMeeting} />
    </AppLayout>
  );
}