import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEmployees } from "@/hooks/useEmployees";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarCheck2, Play, CheckCircle2, Users, FileText, MessageSquare, UserCheck, Search, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof CalendarCheck2 }> = {
  scheduled: { label: "Agendada", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40", icon: CalendarCheck2 },
  in_progress: { label: "Em Andamento", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/40", icon: Play },
  completed: { label: "Concretizada", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/40", icon: CheckCircle2 },
};

export default function MeetingMemorandum() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const { data: employees } = useEmployees("");

  const activeEmployees = (employees ?? []).filter((e) => e.status === "active");
  const filteredEmployees = activeEmployees.filter((e) => {
    if (!employeeSearch) return true;
    return `${e.first_name} ${e.last_name}`.toLowerCase().includes(employeeSearch.toLowerCase());
  });

  const selectedEmployee = activeEmployees.find((e) => e.id === selectedEmployeeId);

  // Fetch all meetings for the selected employee with agendas and responsibles
  const { data: memorandumData, isLoading } = useQuery({
    queryKey: ["meeting-memorandum", selectedEmployeeId],
    enabled: !!selectedEmployeeId,
    queryFn: async () => {
      // Get all meeting participations
      const { data: participations, error: pErr } = await supabase
        .from("meeting_participants")
        .select("meeting_id, present, meetings(id, title, meeting_date, status, meeting_type, description, started_at, end_time, duration_minutes, created_by, departments(name))")
        .eq("employee_id", selectedEmployeeId);
      if (pErr) throw pErr;

      const meetingEntries = (participations ?? [])
        .filter((p: any) => p.meetings)
        .map((p: any) => ({
          ...p.meetings,
          present: p.present,
        }))
        .sort((a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());

      // Fetch agendas for all meetings
      const meetingIds = meetingEntries.map((m: any) => m.id);
      if (meetingIds.length === 0) return [];

      const { data: agendas } = await supabase
        .from("meeting_agendas")
        .select("*, responsible_employee:employees!meeting_agendas_responsible_employee_id_fkey(id, first_name, last_name)")
        .in("meeting_id", meetingIds)
        .order("sort_order");

      // Fetch multiple responsibles from junction table
      const agendaIds = (agendas ?? []).map((a: any) => a.id);
      let responsiblesMap: Record<string, any[]> = {};
      if (agendaIds.length > 0) {
        const { data: resps } = await supabase
          .from("meeting_agenda_responsibles" as any)
          .select("id, agenda_id, employee_id, employees(id, first_name, last_name)")
          .in("agenda_id", agendaIds);
        if (resps) {
          for (const r of resps as any[]) {
            if (!responsiblesMap[r.agenda_id]) responsiblesMap[r.agenda_id] = [];
            responsiblesMap[r.agenda_id].push(r);
          }
        }
      }

      // Group agendas by meeting
      const agendasByMeeting: Record<string, any[]> = {};
      for (const a of agendas ?? []) {
        if (!agendasByMeeting[a.meeting_id]) agendasByMeeting[a.meeting_id] = [];
        agendasByMeeting[a.meeting_id].push({
          ...a,
          responsibles: responsiblesMap[a.id] ?? [],
        });
      }

      return meetingEntries.map((m: any) => ({
        ...m,
        agendas: agendasByMeeting[m.id] ?? [],
      }));
    },
  });

  const totalMeetings = memorandumData?.length ?? 0;
  const completedMeetings = memorandumData?.filter((m: any) => m.status === "completed").length ?? 0;
  const presentCount = memorandumData?.filter((m: any) => m.present && m.status === "completed").length ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Memorando de Reuniões</h1>
          <p className="text-muted-foreground mt-1">Histórico completo de reuniões e pautas por colaborador</p>
        </div>

        {/* Employee selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Pesquisar..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="h-60">
                    {filteredEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} — {emp.position}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {selectedEmployeeId && !isLoading && memorandumData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalMeetings}</p>
                  <p className="text-xs text-muted-foreground">Reuniões Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedMeetings}</p>
                  <p className="text-xs text-muted-foreground">Concretizadas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{presentCount}/{completedMeetings}</p>
                  <p className="text-xs text-muted-foreground">Presenças</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Meetings list */}
        {!selectedEmployeeId && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Selecione um colaborador para visualizar o memorando.</p>
            </CardContent>
          </Card>
        )}

        {selectedEmployeeId && isLoading && (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}

        {selectedEmployeeId && !isLoading && memorandumData?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>Nenhuma reunião encontrada para este colaborador.</p>
            </CardContent>
          </Card>
        )}

        {selectedEmployeeId && !isLoading && memorandumData && memorandumData.length > 0 && (
          <Accordion type="multiple" className="space-y-3">
            {memorandumData.map((meeting: any) => {
              const cfg = statusConfig[meeting.status] ?? statusConfig.scheduled;
              const StatusIcon = cfg.icon;
              const isEmployeeResponsibleForAny = meeting.agendas.some((a: any) => {
                if (a.responsible_employee_id === selectedEmployeeId) return true;
                return a.responsibles.some((r: any) => r.employee_id === selectedEmployeeId);
              });

              return (
                <AccordionItem key={meeting.id} value={meeting.id} className="border rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${cfg.bgColor}`}>
                        <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{meeting.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{cfg.label}</Badge>
                          {meeting.status === "completed" && (
                            <Badge variant={meeting.present ? "default" : "destructive"} className="text-xs shrink-0">
                              {meeting.present ? "Presente" : "Ausente"}
                            </Badge>
                          )}
                          {isEmployeeResponsibleForAny && (
                            <Badge className="text-xs shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800" variant="outline">
                              Responsável
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(meeting.meeting_date), "dd 'de' MMMM 'de' yyyy", { locale: pt })}
                          {meeting.meeting_type && ` · ${meeting.meeting_type}`}
                          {meeting.departments?.name && ` · ${meeting.departments.name}`}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mr-2">
                        {meeting.agendas.length} pauta(s)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {meeting.description && (
                      <p className="text-sm text-muted-foreground mb-3 italic">{meeting.description}</p>
                    )}
                    {meeting.agendas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma pauta registrada.</p>
                    ) : (
                      <div className="space-y-3">
                        {meeting.agendas.map((agenda: any, idx: number) => {
                          const isResponsible =
                            agenda.responsible_employee_id === selectedEmployeeId ||
                            agenda.responsibles.some((r: any) => r.employee_id === selectedEmployeeId);

                          // Build responsible names
                          const respNames: string[] = [];
                          if (agenda.responsibles.length > 0) {
                            for (const r of agenda.responsibles) {
                              if (r.employees) respNames.push(`${r.employees.first_name} ${r.employees.last_name}`);
                            }
                          } else if (agenda.responsible_employee) {
                            respNames.push(`${agenda.responsible_employee.first_name} ${agenda.responsible_employee.last_name}`);
                          }

                          return (
                            <div
                              key={agenda.id}
                              className={`rounded-lg border p-3 ${isResponsible ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20" : "bg-muted/30"}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0">{idx + 1}.</span>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <p className="font-medium text-sm">{agenda.title}</p>
                                  {agenda.description && (
                                    <p className="text-xs text-muted-foreground">{agenda.description}</p>
                                  )}
                                  {agenda.decision ? (
                                    <div className="flex items-start gap-1.5 mt-1">
                                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                      <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                                        {agenda.decision}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">Sem decisão registrada</p>
                                  )}
                                  {respNames.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Responsável:</span> {respNames.join(", ")}
                                    </p>
                                  )}
                                  {respNames.length === 0 && agenda.decision && (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Responsável:</span> Todos os participantes
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </AppLayout>
  );
}
