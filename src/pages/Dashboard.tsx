import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, FileText, Clock, AlertTriangle, Palmtree, CalendarX, Handshake, TrendingUp, Bell, CheckCheck, LogOut, CalendarOff } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";

const stats = [
  { title: "Funcionários Ativos", value: "0", icon: Users, color: "text-primary" },
  { title: "Documentos", value: "0", icon: FileText, color: "text-primary" },
  { title: "Ponto Hoje", value: "0", icon: Clock, color: "text-primary" },
  { title: "Advertências", value: "0", icon: AlertTriangle, color: "text-destructive" },
  { title: "Férias Ativas", value: "0", icon: Palmtree, color: "text-primary" },
  { title: "Faltas do Mês", value: "0", icon: CalendarX, color: "text-destructive" },
  { title: "Reuniões Agendadas", value: "0", icon: Handshake, color: "text-primary" },
  { title: "Horas Extras", value: "0h", icon: TrendingUp, color: "text-primary" },
];

const notificationIcons: Record<string, typeof Bell> = {
  early_leave: LogOut,
  absence_detected: CalendarOff,
};

export default function Dashboard() {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

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
              <CardTitle className="font-display">Aniversariantes do Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Nenhum aniversariante registrado.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
