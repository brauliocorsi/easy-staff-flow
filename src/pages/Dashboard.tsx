import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, FileText, Clock, AlertTriangle, Palmtree, CalendarX, Handshake, TrendingUp, Bell, CheckCheck, LogOut, CalendarOff, Cake } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";

const notificationIcons: Record<string, typeof Bell> = {
  early_leave: LogOut,
  absence_detected: CalendarOff,
};

export default function Dashboard() {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  // Fetch all stats
  const { data: statsData } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = `${today.slice(0, 7)}-01`;

      const [
        employees,
        documents,
        todayRecords,
        warnings,
        activeVacations,
        monthAbsences,
        scheduledMeetings,
      ] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("time_clock_records").select("id", { count: "exact", head: true }).eq("record_date", today),
        supabase.from("warnings").select("id", { count: "exact", head: true }),
        supabase.from("vacation_requests").select("id", { count: "exact", head: true })
          .eq("status", "approved").lte("start_date", today).gte("end_date", today),
        supabase.from("absences").select("id", { count: "exact", head: true })
          .gte("absence_date", monthStart).lte("absence_date", today),
        supabase.from("meetings").select("id", { count: "exact", head: true })
          .eq("status", "scheduled").gte("meeting_date", today),
      ]);

      return {
        employees: employees.count ?? 0,
        documents: documents.count ?? 0,
        todayRecords: todayRecords.count ?? 0,
        warnings: warnings.count ?? 0,
        activeVacations: activeVacations.count ?? 0,
        monthAbsences: monthAbsences.count ?? 0,
        scheduledMeetings: scheduledMeetings.count ?? 0,
      };
    },
    enabled: !!isAdmin,
  });

  // Fetch birthdays this month
  const { data: birthdays } = useQuery({
    queryKey: ["dashboard-birthdays"],
    queryFn: async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, birth_date, avatar_url")
        .eq("status", "active")
        .not("birth_date", "is", null);
      if (error) throw error;
      return (data || [])
        .filter((e) => {
          if (!e.birth_date) return false;
          const d = new Date(e.birth_date);
          return d.getMonth() + 1 === month;
        })
        .sort((a, b) => {
          const da = new Date(a.birth_date!).getDate();
          const db = new Date(b.birth_date!).getDate();
          return da - db;
        });
    },
    enabled: !!isAdmin,
  });

  const stats = [
    { title: "Funcionários Ativos", value: String(statsData?.employees ?? 0), icon: Users, color: "text-primary" },
    { title: "Documentos", value: String(statsData?.documents ?? 0), icon: FileText, color: "text-primary" },
    { title: "Ponto Hoje", value: String(statsData?.todayRecords ?? 0), icon: Clock, color: "text-primary" },
    { title: "Advertências", value: String(statsData?.warnings ?? 0), icon: AlertTriangle, color: "text-destructive" },
    { title: "Férias Ativas", value: String(statsData?.activeVacations ?? 0), icon: Palmtree, color: "text-primary" },
    { title: "Faltas do Mês", value: String(statsData?.monthAbsences ?? 0), icon: CalendarX, color: "text-destructive" },
    { title: "Reuniões Agendadas", value: String(statsData?.scheduledMeetings ?? 0), icon: Handshake, color: "text-primary" },
  ];

  const { data: notifications } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications?.filter((n: any) => !n.read).map((n: any) => n.id) || [];
      if (!unreadIds.length) return;
      const { error } = await supabase.from("admin_notifications").update({ read: true }).in("id", unreadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      toast.success("Todas as notificações marcadas como lidas");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do sistema de RH</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Notifications Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="font-display flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificações
                </CardTitle>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Marcar todas
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!isAdmin ? (
                <p className="text-sm text-muted-foreground px-6 pb-6">Faça login como administrador para ver as notificações.</p>
              ) : !notifications?.length ? (
                <p className="text-sm text-muted-foreground px-6 pb-6">Nenhuma notificação no momento.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {notifications.map((notif: any) => {
                      const Icon = notificationIcons[notif.type] || Bell;
                      const isEarlyLeave = notif.type === "early_leave";
                      return (
                        <button
                          key={notif.id}
                          onClick={() => !notif.read && markReadMutation.mutate(notif.id)}
                          className={`w-full text-left px-6 py-4 flex gap-3 items-start transition-colors hover:bg-muted/50 ${
                            !notif.read ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className={`mt-0.5 rounded-full p-2 shrink-0 ${
                            isEarlyLeave ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: pt })}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Birthdays card */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Cake className="h-5 w-5" />
                Aniversariantes do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!birthdays?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum aniversariante este mês.</p>
              ) : (
                <div className="space-y-3">
                  {birthdays.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={emp.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{emp.first_name[0]}{emp.last_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(emp.birth_date!), "dd 'de' MMMM", { locale: pt })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
