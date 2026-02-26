import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarCheck2, Play, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  employeeId: string;
}

const statusConfig: Record<string, { label: string; icon: typeof CalendarCheck2; variant: "default" | "secondary" | "outline" }> = {
  scheduled: { label: "Agendada", icon: CalendarCheck2, variant: "outline" },
  in_progress: { label: "Em Andamento", icon: Play, variant: "default" },
  completed: { label: "Concretizada", icon: CheckCircle2, variant: "secondary" },
};

export function EmployeeMeetings({ employeeId }: Props) {
  const navigate = useNavigate();

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["employee-meetings", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select("meeting_id, present, meetings(id, title, meeting_date, status, meeting_type)")
        .eq("employee_id", employeeId);
      if (error) throw error;
      return (data || [])
        .filter((p: any) => p.meetings)
        .map((p: any) => ({
          id: p.meetings.id,
          title: p.meetings.title,
          meeting_date: p.meetings.meeting_date,
          status: p.meetings.status,
          meeting_type: p.meetings.meeting_type,
          present: p.present,
        }))
        .sort((a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
    },
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (!meetings?.length) return <p className="text-xs text-muted-foreground">Nenhuma reunião encontrada.</p>;

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {meetings.map((m: any) => {
        const cfg = statusConfig[m.status] || statusConfig.scheduled;
        const Icon = cfg.icon;
        return (
          <div
            key={m.id}
            className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/reunioes/${m.id}`)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(m.meeting_date), "dd/MM/yyyy")}
                  {m.meeting_type && ` · ${m.meeting_type}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {m.status === "completed" && (
                <Badge variant={m.present ? "default" : "destructive"} className="text-xs">
                  {m.present ? "Presente" : "Ausente"}
                </Badge>
              )}
              <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
