import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, User, Briefcase, Calendar, MapPin, Phone, Mail, Hash,
  AlertTriangle, CheckCircle, Palmtree, CalendarCheck2, Play, CheckCircle2,
  Clock, FileText, GraduationCap, Loader2, XCircle, ClipboardCheck, Star,
  HardHat, Wrench, Settings2, Stethoscope
} from "lucide-react";
import { format } from "date-fns";
import { isVacationEnjoyed } from "@/lib/vacationStatus";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  on_leave: { label: "Afastado", variant: "outline" },
};

const meetingStatusConfig: Record<string, { label: string; icon: typeof CalendarCheck2; variant: "default" | "secondary" | "outline" }> = {
  scheduled: { label: "Agendada", icon: CalendarCheck2, variant: "outline" },
  in_progress: { label: "Em Andamento", icon: Play, variant: "default" },
  completed: { label: "Concretizada", icon: CheckCircle2, variant: "secondary" },
};

const warningTypeMap: Record<string, string> = {
  verbal: "Verbal",
  written: "Escrita",
  suspension: "Suspensão",
  termination: "Justa Causa",
};

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime: refresh health data when vacations / absences / warnings change
  useEffect(() => {
    if (!id) return;
    const filter = `employee_id=eq.${id}`;
    const channel = supabase
      .channel(`employee-profile-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vacation_requests", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-vacations", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "absences", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-absences", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "warnings", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-warnings", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Employee data
  const { data: employee, isLoading: loadingEmp } = useQuery({
    queryKey: ["employee-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Absences
  const { data: absences } = useQuery({
    queryKey: ["employee-absences", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .eq("employee_id", id!)
        .order("absence_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Warnings
  const { data: warnings } = useQuery({
    queryKey: ["employee-warnings", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warnings")
        .select("*")
        .eq("employee_id", id!)
        .order("warning_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Vacations
  const { data: vacations } = useQuery({
    queryKey: ["employee-vacations", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("employee_id", id!)
        .order("year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Meetings
  const { data: meetings } = useQuery({
    queryKey: ["employee-meetings-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select("present, meetings(id, title, meeting_date, status, meeting_type)")
        .eq("employee_id", id!);
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

  // Contracts
  const { data: contracts } = useQuery({
    queryKey: ["employee-contracts", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("employee_id", id!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Evaluations
  const { data: evaluations } = useQuery({
    queryKey: ["employee-evaluations", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_evaluations")
        .select("*, evaluator:evaluator_id(first_name, last_name)")
        .eq("employee_id", id!)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Trainings
  const { data: trainingsData } = useQuery({
    queryKey: ["employee-trainings", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_trainings")
        .select("*")
        .eq("employee_id", id!)
        .order("training_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // EPIs
  const { data: episData } = useQuery({
    queryKey: ["employee-epis", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_deliveries" as any)
        .select("*")
        .eq("employee_id", id!)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Tools
  const { data: toolsData } = useQuery({
    queryKey: ["employee-tools", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_assignments" as any)
        .select("*")
        .eq("employee_id", id!)
        .order("assigned_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Maintenance Logs
  const { data: maintenanceData } = useQuery({
    queryKey: ["employee-maintenance", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_logs" as any)
        .select("*")
        .eq("employee_id", id!)
        .order("completed_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Medical Exams
  const { data: medicalExams } = useQuery({
    queryKey: ["employee-medical-exams", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_exams" as any)
        .select("*")
        .eq("employee_id", id!)
        .order("exam_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (loadingEmp) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Funcionário não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/funcionarios")}>
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  const st = statusMap[employee.status] || statusMap.active;

  // Stats
  const unjustifiedAbsences = absences?.filter((a) => !a.justified).length || 0;
  const justifiedAbsences = absences?.filter((a) => a.justified).length || 0;
  const totalWarnings = warnings?.length || 0;
  const currentYear = new Date().getFullYear();
  const currentVacations = vacations?.filter((v) => v.year === currentYear) || [];
  const vacDaysApproved = currentVacations.reduce((s, v) => s + (v.status === "approved" || isVacationEnjoyed(v as any) ? v.days_count : 0), 0);
  const vacDaysEnjoyed = currentVacations.reduce((s, v) => s + (isVacationEnjoyed(v as any) ? v.days_count : 0), 0);
  const vacEntitled = currentVacations[0]?.total_entitled_days || 22;
  const totalMeetings = meetings?.length || 0;
  const meetingsPresent = meetings?.filter((m: any) => m.present && m.status === "completed").length || 0;
  const meetingsCompleted = meetings?.filter((m: any) => m.status === "completed").length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/funcionarios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="h-16 w-16">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {employee.first_name} {employee.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground">{employee.position}</span>
                <Badge variant={st.variant}>{st.label}</Badge>
                {(employee as any).auto_clock && (
                  <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                    ⚡ Ponto Automático
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unjustifiedAbsences}</p>
                <p className="text-xs text-muted-foreground">Faltas Injustif.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalWarnings}</p>
                <p className="text-xs text-muted-foreground">Advertências</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: "hsl(var(--primary) / 0.1)" }}>
                <Palmtree className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{vacDaysEnjoyed}<span className="text-sm font-normal text-muted-foreground">/{vacEntitled}</span></p>
                <p className="text-xs text-muted-foreground">Férias Gozadas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: "hsl(var(--primary) / 0.1)" }}>
                <CalendarCheck2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMeetings}</p>
                <p className="text-xs text-muted-foreground">Reuniões</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info + Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Personal Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              <InfoRow icon={Phone} label="Telefone" value={employee.phone || "—"} />
              <InfoRow icon={Hash} label="NIF" value={employee.nif || "—"} />
              <InfoRow icon={Hash} label="NISS" value={employee.niss || "—"} />
              <InfoRow icon={Calendar} label="Admissão" value={employee.hire_date ? format(new Date(employee.hire_date + "T00:00:00"), "dd/MM/yyyy") : "—"} />
              <InfoRow icon={Calendar} label="Nascimento" value={employee.birth_date ? format(new Date(employee.birth_date + "T00:00:00"), "dd/MM/yyyy") : "—"} />
              <InfoRow icon={Briefcase} label="Departamento" value={(employee as any)?.departments?.name || "—"} />
              {employee.morada && (
                <InfoRow icon={MapPin} label="Morada" value={`${employee.morada}, ${employee.cidade || ""} ${employee.codigo_postal || ""}`} />
              )}
            </CardContent>
          </Card>

          {/* Right: Sections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Absences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Faltas
                  <Badge variant="secondary" className="ml-auto text-xs">{absences?.length || 0} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!absences?.length ? (
                  <p className="text-sm text-muted-foreground">Sem faltas registadas.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {absences.slice(0, 20).map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center gap-2">
                          {a.justified ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm">{format(new Date(a.absence_date + "T00:00:00"), "dd/MM/yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.reason && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{a.reason}</span>}
                          <Badge variant={a.justified ? "outline" : "destructive"} className="text-xs">
                            {a.justified ? "Justificada" : "Injustificada"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warnings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-destructive" />
                  Advertências
                  <Badge variant="secondary" className="ml-auto text-xs">{totalWarnings} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!warnings?.length ? (
                  <p className="text-sm text-muted-foreground">Sem advertências.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {warnings.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{w.reason}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(w.warning_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {warningTypeMap[w.type] || w.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vacations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-primary" />
                  Férias
                  <div className="ml-auto flex items-center gap-1.5">
                    <Badge variant="default" className="text-xs bg-green-600">
                      {vacDaysEnjoyed}d gozados
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {Math.max(0, vacEntitled - vacDaysApproved)}d restantes
                    </Badge>
                    <Badge variant="outline" className="text-xs">{vacEntitled}d direito</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!vacations?.length ? (
                  <p className="text-sm text-muted-foreground">Sem pedidos de férias.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {vacations.map((v) => {
                      const vacStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
                        approved: { label: "Aprovado", variant: "default" },
                        pending: { label: "Pendente", variant: "outline" },
                        employee_suggested: { label: "Sugerido", variant: "secondary" },
                        rejected: { label: "Recusado", variant: "destructive" },
                      };
                      const vs = vacStatusMap[v.status] || { label: v.status, variant: "outline" as const };
                      return (
                        <div key={v.id} className="flex items-center justify-between p-2 rounded-md border">
                          <div>
                            <p className="text-sm font-medium">
                              {format(new Date(v.start_date + "T00:00:00"), "dd/MM")} — {format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">{v.days_count} dias · {v.year}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isVacationEnjoyed(v as any) && <Badge variant="default" className="text-xs">Gozado</Badge>}
                            <Badge variant={vs.variant} className="text-xs">{vs.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meetings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-primary" />
                  Reuniões
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {meetingsCompleted > 0 ? `${meetingsPresent}/${meetingsCompleted} presente` : `${totalMeetings} total`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!meetings?.length ? (
                  <p className="text-sm text-muted-foreground">Sem reuniões registadas.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {meetings.map((m: any) => {
                      const cfg = meetingStatusConfig[m.status] || meetingStatusConfig.scheduled;
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
                )}
              </CardContent>
            </Card>

            {/* Contracts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Contratos
                  <Badge variant="secondary" className="ml-auto text-xs">{contracts?.length || 0} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!contracts?.length ? (
                  <p className="text-sm text-muted-foreground">Sem contratos.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {contracts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium capitalize">{c.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(c.start_date + "T00:00:00"), "dd/MM/yyyy")}
                            {c.end_date ? ` — ${format(new Date(c.end_date + "T00:00:00"), "dd/MM/yyyy")}` : " — Indeterminado"}
                          </p>
                        </div>
                        <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                          {c.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evaluations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Avaliações
                  <Badge variant="secondary" className="ml-auto text-xs">{evaluations?.length || 0} concluídas</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!evaluations?.length ? (
                  <p className="text-sm text-muted-foreground">Sem avaliações concluídas.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {evaluations.map((ev: any) => (
                      <div key={ev.id} className="p-2 rounded-md border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Avaliador: {ev.evaluator?.first_name} {ev.evaluator?.last_name}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={`h-3.5 w-3.5 ${n <= (ev.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ev.completed_at && format(new Date(ev.completed_at), "dd/MM/yyyy")}
                        </p>
                        {ev.strengths && <p className="text-xs"><span className="font-medium">Pontos fortes:</span> {ev.strengths}</p>}
                        {ev.improvements && <p className="text-xs"><span className="font-medium">Melhorias:</span> {ev.improvements}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trainings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Formações
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {(() => {
                      const curYear = new Date().getFullYear();
                      const curTrainings = trainingsData?.filter((t: any) => t.year === curYear) || [];
                      const totalH = curTrainings.reduce((s: number, t: any) => s + Number(t.hours), 0);
                      const remaining = Math.max(40 - totalH, 0);
                      return remaining > 0 ? `${totalH}h/40h (${remaining}h restantes)` : `${totalH}h/40h ✓`;
                    })()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!trainingsData?.length ? (
                  <p className="text-sm text-muted-foreground">Sem formações registadas.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {trainingsData.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.training_date + "T00:00:00"), "dd/MM/yyyy")} · {t.hours}h · {t.type === "internal" ? "Interna" : "Externa"}
                            {t.trainer_name && ` · ${t.trainer_name}`}
                          </p>
                        </div>
                        <Badge variant={t.status === "signed" ? "default" : "outline"} className="text-xs">
                          {t.status === "signed" ? "Assinada" : "Registada"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EPIs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-primary" />
                  EPIs Entregues
                  <Badge variant="secondary" className="ml-auto text-xs">{episData?.length || 0} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!episData?.length ? (
                  <p className="text-sm text-muted-foreground">Sem EPIs registados.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {episData.map((epi: any) => (
                      <div key={epi.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{epi.item_name} (x{epi.quantity})</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(epi.delivery_date + "T00:00:00"), "dd/MM/yyyy")}
                            {epi.expiry_date && ` · Validade: ${format(new Date(epi.expiry_date + "T00:00:00"), "dd/MM/yyyy")}`}
                          </p>
                        </div>
                        <Badge variant={epi.status === "delivered" ? "default" : epi.status === "expired" ? "destructive" : "secondary"} className="text-xs">
                          {epi.status === "delivered" ? "Entregue" : epi.status === "expired" ? "Expirado" : "Devolvido"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ferramentas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  Ferramentas Atribuídas
                  <Badge variant="secondary" className="ml-auto text-xs">{toolsData?.filter((t: any) => t.status === "assigned").length || 0} ativas</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!toolsData?.length ? (
                  <p className="text-sm text-muted-foreground">Sem ferramentas atribuídas.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {toolsData.map((tool: any) => (
                      <div key={tool.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{tool.tool_name}{tool.serial_number ? ` (${tool.serial_number})` : ""}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tool.assigned_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                        </div>
                        <Badge variant={tool.status === "assigned" ? "default" : "secondary"} className="text-xs">
                          {tool.status === "assigned" ? "Atribuída" : "Devolvida"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manutenções */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Manutenções Realizadas
                  <Badge variant="secondary" className="ml-auto text-xs">{maintenanceData?.length || 0} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!maintenanceData?.length ? (
                  <p className="text-sm text-muted-foreground">Sem manutenções registadas.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {maintenanceData.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{format(new Date(log.completed_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{log.notes || "Sem observações"}</p>
                        </div>
                        <Badge variant={log.status === "completed" ? "default" : "outline"} className="text-xs">
                          {log.status === "completed" ? "Concluído" : "Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medicina do Trabalho */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Medicina do Trabalho
                  <Badge variant="secondary" className="ml-auto text-xs">{medicalExams?.length || 0} exames</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!medicalExams?.length ? (
                  <p className="text-sm text-muted-foreground">Sem exames médicos registados.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {medicalExams.map((ex: any) => {
                      const resMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                        fit: { label: "Apto", variant: "default" },
                        fit_conditional: { label: "Apto Condicionado", variant: "outline" },
                        temporarily_unfit: { label: "Inapto Temporário", variant: "secondary" },
                        unfit: { label: "Inapto", variant: "destructive" },
                      };
                      const r = resMap[ex.result] || resMap.fit;
                      const typeMap: Record<string, string> = { admission: "Admissão", periodic: "Periódico", occasional: "Ocasional", return: "Regresso", dismissal: "Cessação" };
                      return (
                        <div key={ex.id} className="flex items-center justify-between p-2 rounded-md border">
                          <div>
                            <p className="text-sm font-medium">{typeMap[ex.exam_type] || ex.exam_type} · {ex.year}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ex.exam_date + "T00:00:00"), "dd/MM/yyyy")}
                              {ex.doctor_name && ` · Dr. ${ex.doctor_name}`}
                              {ex.provider && ` · ${ex.provider}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {ex.file_url && (
                              <a href={ex.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                Ficheiro
                              </a>
                            )}
                            <Badge variant={r.variant} className="text-xs">{r.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
