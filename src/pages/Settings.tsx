import { AppLayout } from "@/components/layout/AppLayout";
import { ScheduleTemplateManager } from "@/components/settings/ScheduleTemplateManager";
import { AlarmManager } from "@/components/settings/AlarmManager";
import { DepartmentManager } from "@/components/settings/DepartmentManager";
import { UserManager } from "@/components/settings/UserManager";
import { HolidayManager } from "@/components/settings/HolidayManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink, Monitor, Clock, UserPlus, Building2, Bell, CalendarClock, Link, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const baseUrl = window.location.origin;
  const attendanceLink = `${baseUrl}/presenca`;
  const timeClockLink = `${baseUrl}/ponto`;
  const portalLink = `${baseUrl}/portal`;

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const copyToClipboard = (link: string, label: string) => {
    navigator.clipboard.writeText(link);
    toast.success(`Link de ${label} copiado!`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie as configurações do sistema</p>
        </div>

        <Tabs defaultValue="links" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="links" className="gap-2">
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">Links</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Utilizadores</span>
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Departamentos</span>
            </TabsTrigger>
            <TabsTrigger value="alarms" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alarmes</span>
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              <span className="hidden sm:inline">Horários</span>
            </TabsTrigger>
            <TabsTrigger value="holidays" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Feriados</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Links Públicos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dashboard de Presença</label>
                  <div className="flex gap-2">
                    <Input value={attendanceLink} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(attendanceLink, "Presença")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={attendanceLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Protegido por PIN. Ideal para ecrãs/TVs no escritório.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Relógio de Ponto (Geral)</label>
                  <div className="flex gap-2">
                    <Input value={timeClockLink} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(timeClockLink, "Relógio de Ponto")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={timeClockLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Terminal de ponto para todos os funcionários.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Portal do Funcionário</label>
                  <div className="flex gap-2">
                    <Input value={portalLink} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(portalLink, "Portal")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={portalLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">O funcionário acede com PIN para ver os seus dados e enviar sugestões.</p>
                </div>
              </CardContent>
            </Card>

            {departments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Relógio de Ponto por Departamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    URLs públicas que mostram apenas os funcionários do departamento correspondente.
                  </p>
                  {departments.map((dept) => {
                    const deptLink = `${baseUrl}/ponto?dept=${dept.id}`;
                    return (
                      <div key={dept.id} className="space-y-1">
                        <label className="text-sm font-medium">{dept.name}</label>
                        <div className="flex gap-2">
                          <Input value={deptLink} readOnly className="font-mono text-sm" />
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(deptLink, dept.name)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" asChild>
                            <a href={deptLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManager />
          </TabsContent>

          <TabsContent value="departments" className="mt-6">
            <DepartmentManager />
          </TabsContent>

          <TabsContent value="alarms" className="mt-6">
            <AlarmManager />
          </TabsContent>

          <TabsContent value="schedules" className="mt-6">
            <ScheduleTemplateManager />
          </TabsContent>

          <TabsContent value="holidays" className="mt-6">
            <HolidayManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
