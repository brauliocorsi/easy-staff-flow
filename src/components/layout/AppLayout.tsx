import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, CheckCheck, LogOut, CalendarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const notificationIcons: Record<string, typeof Bell> = {
  early_leave: LogOut,
  absence_detected: CalendarOff,
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
    refetchInterval: 30000,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 backdrop-blur-sm px-6">
            <SidebarTrigger />
            {isAdmin && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[380px] p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <p className="font-semibold text-sm">Notificações</p>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllReadMutation.mutate()}>
                        <CheckCheck className="h-3.5 w-3.5 mr-1" />
                        Marcar todas
                      </Button>
                    )}
                  </div>
                  {!notifications?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
                  ) : (
                    <ScrollArea className="max-h-[400px]">
                      <div className="divide-y">
                        {notifications.map((notif: any) => {
                          const Icon = notificationIcons[notif.type] || Bell;
                          const isEarlyLeave = notif.type === "early_leave";
                          return (
                            <button
                              key={notif.id}
                              onClick={() => {
                                if (!notif.read) markReadMutation.mutate(notif.id);
                              }}
                              className={`w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-muted/50 ${
                                !notif.read ? "bg-primary/5" : ""
                              }`}
                            >
                              <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
                                isEarlyLeave ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                              }`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-xs font-medium ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                                    {notif.title}
                                  </p>
                                  {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1">
                                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: pt })}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                  <div className="border-t px-4 py-2">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setOpen(false); navigate("/"); }}>
                      Ver todas no Dashboard
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </header>
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
