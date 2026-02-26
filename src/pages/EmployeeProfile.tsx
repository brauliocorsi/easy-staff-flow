import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Clock, FileText, GraduationCap, Loader2, XCircle
} from "lucide-react";
import { format } from "date-fns";

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
  const vacDaysApproved = currentVacations.reduce((s, v) => s + (v.status === "approved" || v.enjoyed ? v.days_count : 0), 0);
  const vacDaysEnjoyed = currentVacations.reduce((s, v) => s + (v.enjoyed ? v.days_count : 0), 0);
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
                  <Badge variant="secondary" className="ml-auto text-xs">{vacations?.length || 0} pedidos</Badge>
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
                            {v.enjoyed && <Badge variant="default" className="text-xs">Gozado</Badge>}
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
