import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, Users, ExternalLink } from "lucide-react";
import { useMeetings } from "@/hooks/useMeetings";
import { MeetingFormDialog } from "@/components/meetings/MeetingFormDialog";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendada", variant: "secondary" },
  in_progress: { label: "Em Andamento", variant: "default" },
  completed: { label: "Concretizada", variant: "outline" },
};

export default function Meetings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: meetings, isLoading } = useMeetings();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Reuniões</h1>
            <p className="text-muted-foreground mt-1">Agende e gerencie reuniões com pautas</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
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
              const status = statusMap[m.status] ?? statusMap.scheduled;
              const participantCount = (m as any).meeting_participants?.length ?? 0;

              return (
                <Card
                  key={m.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/reunioes/${m.id}`)}
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display font-semibold text-lg">{m.title}</h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(m.meeting_date), "dd MMM yyyy", { locale: pt })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(m.meeting_date), "HH:mm")}
                          {(m as any).end_time && ` - ${format(new Date((m as any).end_time), "HH:mm")}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {participantCount} participante(s)
                        </span>
                      </div>
                    </div>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <MeetingFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppLayout>
  );
}
