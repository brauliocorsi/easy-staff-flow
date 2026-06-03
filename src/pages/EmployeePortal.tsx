import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Lock, AlertTriangle, CheckCircle, XCircle, Palmtree,
  CalendarCheck2, Play, CheckCircle2, FileText, Briefcase, Star,
  MessageSquarePlus, User, Mail, Phone, Calendar, MapPin, Hash,
  ClipboardCheck, GraduationCap, HardHat, Wrench, Settings2, ClipboardList,
  Clock, Printer
} from "lucide-react";
import { isVacationEnjoyed } from "@/lib/vacationStatus";
import { format } from "date-fns";
import { generateVacationMapPdf } from "@/lib/generateVacationMapPdf";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const meetingStatusConfig: Record<string, { label: string; icon: typeof CalendarCheck2; variant: "default" | "secondary" | "outline" }> = {
  scheduled: { label: "Agendada", icon: CalendarCheck2, variant: "outline" },
  in_progress: { label: "Em Andamento", icon: Play, variant: "default" },
  completed: { label: "Concretizada", icon: CheckCircle2, variant: "secondary" },
};

const warningTypeMap: Record<string, string> = {
  verbal: "Verbal", written: "Escrita", suspension: "Suspensão", termination: "Justa Causa",
};

const freqMap: Record<string, string> = {
  daily: "Diária", weekly: "Semanal", monthly: "Mensal",
};

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcPortalCompletion(checklistData: any, template: any[]): number {
  if (!Array.isArray(template) || template.length === 0) return 100;
  let done = 0;
  for (const field of template) {
    const val = checklistData?.[field.name];
    if (field.type === "checkbox") {
      if (val === true) done++;
    } else if (val !== undefined && val !== null && val !== "") {
      done++;
    }
  }
  return Math.round((done / template.length) * 100);
}

export default function EmployeePortal() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState({
    type: "suggestion",
    message: "",
    rating: 0,
    is_anonymous: false,
    evaluated_leader_id: "",
  });
  // Evaluations
  const [pendingEvals, setPendingEvals] = useState<any[]>([]);
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [activeEval, setActiveEval] = useState<any>(null);
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalForm, setEvalForm] = useState({
    rating: 0, performance_rating: 0, teamwork_rating: 0,
    punctuality_rating: 0, communication_rating: 0,
    strengths: "", improvements: "", comments: "",
  });
  // Maintenance log
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [checklistData, setChecklistData] = useState<Record<string, any>>({});
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [logHistoryDetail, setLogHistoryDetail] = useState<any>(null);

  const handleLogin = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("employee-portal", {
        body: { action: "login", pin },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res);
      // Fetch pending evaluations
      const { data: evalRes } = await supabase.functions.invoke("employee-portal", {
        body: { action: "get_pending_evaluations", employee_id: res.employee.id },
      });
      if (evalRes?.evaluations) setPendingEvals(evalRes.evaluations);
    } catch (err: any) {
      toast.error(err.message || "PIN inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestion.message.trim()) {
      toast.error("Escreva uma mensagem");
      return;
    }
    if (suggestion.type === "leadership_evaluation" && !suggestion.evaluated_leader_id) {
      toast.error("Selecione o líder a avaliar");
      return;
    }
    setSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("employee-portal", {
        body: {
          action: "submit_suggestion",
          employee_id: data?.employee?.id,
          suggestion,
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success("Enviado com sucesso!");
      setDialogOpen(false);
      setSuggestion({ type: "suggestion", message: "", rating: 0, is_anonymous: false, evaluated_leader_id: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!activeEval || evalForm.rating === 0) {
      toast.error("Preencha pelo menos a nota geral");
      return;
    }
    setEvalSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("employee-portal", {
        body: {
          action: "submit_evaluation",
          employee_id: data?.employee?.id,
          evaluation_id: activeEval.id,
          evaluation_data: evalForm,
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success("Avaliação submetida com sucesso!");
      setPendingEvals((prev) => prev.filter((e) => e.id !== activeEval.id));
      setEvalDialogOpen(false);
      setActiveEval(null);
      setEvalForm({ rating: 0, performance_rating: 0, teamwork_rating: 0, punctuality_rating: 0, communication_rating: 0, strengths: "", improvements: "", comments: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao submeter");
    } finally {
      setEvalSubmitting(false);
    }
  };

  const openMaintenanceDialog = (task: any) => {
    setActiveTask(task);
    setChecklistData({});
    setMaintenanceNotes("");
    setMaintenanceDialogOpen(true);
  };

  const handleSubmitMaintenanceLog = async () => {
    if (!activeTask) return;
    setMaintenanceSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("employee-portal", {
        body: {
          action: "submit_maintenance_log",
          employee_id: data?.employee?.id,
          maintenance_log: {
            task_id: activeTask.id,
            machine_id: activeTask.machine_id,
            checklist_data: checklistData,
            notes: maintenanceNotes,
          },
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success("Manutenção registada com sucesso!");
      setMaintenanceDialogOpen(false);
      setActiveTask(null);
      // Add to logs list
      setData((prev: any) => ({
        ...prev,
        maintenance_logs: [
          { id: crypto.randomUUID(), completed_date: new Date().toISOString().split("T")[0], notes: maintenanceNotes, status: "completed", checklist_data: checklistData },
          ...(prev.maintenance_logs || []),
        ],
      }));
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar manutenção");
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  // PIN Login screen
  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10 w-fit">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-display text-xl">Portal do Funcionário</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Insira o seu PIN de 4 dígitos para aceder</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <InputOTP maxLength={4} value={pin} onChange={setPin}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" onClick={handleLogin} disabled={pin.length !== 4 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emp = data.employee;
  const initials = `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase();
  const unjustified = data.absences.filter((a: any) => !a.justified).length;
  const justified = data.absences.filter((a: any) => a.justified).length;
  const currentYear = new Date().getFullYear();
  const curVac = data.vacations.filter((v: any) => v.year === currentYear);
  const vacEnjoyed = curVac.reduce((s: number, v: any) => s + (isVacationEnjoyed(v) ? v.days_count : 0), 0);
  const vacEntitled = curVac[0]?.total_entitled_days || 22;
  const meetingsCompleted = data.meetings.filter((m: any) => m.status === "completed").length;
  const meetingsPresent = data.meetings.filter((m: any) => m.present && m.status === "completed").length;
  const curTrainings = (data.trainings || []).filter((t: any) => t.year === currentYear);
  const trainingHours = curTrainings.reduce((s: number, t: any) => s + Number(t.hours), 0);
  const trainingRemaining = Math.max(40 - trainingHours, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={emp.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display font-bold text-lg">{emp.first_name} {emp.last_name}</h1>
              <p className="text-sm text-muted-foreground">{emp.position}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Sugestão / Avaliação</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setData(null); setPin(""); }}>Sair</Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <SummaryCard icon={AlertTriangle} iconClass="text-destructive" bgClass="bg-destructive/10" value={unjustified} label="Faltas Injustif." />
          <SummaryCard icon={FileText} iconClass="text-destructive" bgClass="bg-destructive/10" value={data.warnings.length} label="Advertências" />
          <SummaryCard icon={Palmtree} iconClass="text-primary" bgClass="bg-primary/10" value={`${vacEnjoyed}/${vacEntitled}`} label="Férias Gozadas" />
          <SummaryCard icon={CalendarCheck2} iconClass="text-primary" bgClass="bg-primary/10" value={data.meetings.length} label="Reuniões" />
          <SummaryCard icon={GraduationCap} iconClass="text-primary" bgClass="bg-primary/10" value={`${trainingHours}h/40h`} label="Formação" />
          {(() => {
            const mins = Number(data.time_bank_balance_minutes ?? 0);
            const sign = mins < 0 ? "-" : "";
            const abs = Math.abs(mins);
            const hh = Math.floor(abs / 60);
            const mm = abs % 60;
            const txt = `${sign}${hh}h${String(mm).padStart(2, "0")}`;
            const positive = mins >= 0;
            return (
              <SummaryCard
                icon={Clock}
                iconClass={positive ? "text-primary" : "text-destructive"}
                bgClass={positive ? "bg-primary/10" : "bg-destructive/10"}
                value={txt}
                label="Banco de Horas"
              />
            );
          })()}
        </div>

        {/* Personal Info */}
        <Card>
          <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><User className="h-4 w-4" /> Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={Mail} label="Email" value={emp.email} />
            <InfoRow icon={Phone} label="Telefone" value={emp.phone || "—"} />
            <InfoRow icon={Calendar} label="Admissão" value={emp.hire_date ? format(new Date(emp.hire_date + "T00:00:00"), "dd/MM/yyyy") : "—"} />
            <InfoRow icon={Briefcase} label="Departamento" value={emp.departments?.name || "—"} />
            {emp.morada && <InfoRow icon={MapPin} label="Morada" value={`${emp.morada}, ${emp.cidade || ""}`} />}
          </CardContent>
        </Card>

        {/* Time Clock Records */}
        <SectionCard title="Registos de Ponto" icon={Clock} iconClass="text-primary" count={(data.time_clock_records || []).length}>
          {(data.time_clock_records || []).length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(data.time_clock_records || []).map((r: any) => {
                const fmtTime = (ts: string | null) => {
                  if (!ts) return "—";
                  const d = new Date(ts);
                  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                };
                const hasAll = r.clock_in && r.clock_out;
                return (
                  <div key={r.id} className="p-2 rounded-md border">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{format(new Date(r.record_date + "T00:00:00"), "dd/MM/yyyy (EEEE)")}</p>
                      <Badge variant={hasAll ? "default" : "outline"} className="text-xs">
                        {hasAll ? "Completo" : "Parcial"}
                      </Badge>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Entrada: {fmtTime(r.clock_in)}</span>
                      <span>Almoço: {fmtTime(r.lunch_out)}</span>
                      <span>Retorno: {fmtTime(r.lunch_in)}</span>
                      <span>Saída: {fmtTime(r.clock_out)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Faltas" icon={AlertTriangle} iconClass="text-destructive" count={data.absences.length}>
          {data.absences.length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {data.absences.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-md border">
                  <div className="flex items-center gap-2">
                    {a.justified ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="text-sm">{format(new Date(a.absence_date + "T00:00:00"), "dd/MM/yyyy")}</span>
                  </div>
                  <Badge variant={a.justified ? "outline" : "destructive"} className="text-xs">
                    {a.justified ? "Justificada" : "Injustificada"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Warnings */}
        <SectionCard title="Advertências" icon={FileText} iconClass="text-destructive" count={data.warnings.length}>
          {data.warnings.length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {data.warnings.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-2 rounded-md border">
                  <div>
                    <p className="text-sm font-medium">{w.reason}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(w.warning_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">{warningTypeMap[w.type] || w.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Vacations */}
        <SectionCard
          title="Férias"
          icon={Palmtree}
          iconClass="text-primary"
          count={data.vacations.length}
          extra={`${vacEnjoyed} de ${vacEntitled} dias gozados em ${currentYear}`}
        >
          {(() => {
            const deptName: string | undefined = emp.departments?.name;
            const sectorScope = deptName === "Fábrica" ? "factory" : deptName === "Armazém" ? "warehouse" : null;
            const sectorVacs = data.sector_vacations || [];
            if (!sectorScope || sectorVacs.length === 0) return null;
            return (
              <div className="mb-3 flex items-center justify-between p-2 rounded-md bg-muted/50 border">
                <div className="text-xs text-muted-foreground">
                  Mapa de férias do setor <strong>{deptName}</strong> ({currentYear})
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateVacationMapPdf(sectorVacs, currentYear, sectorScope as any)}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                </Button>
              </div>
            );
          })()}
          {data.vacations.length === 0 ? <EmptyText /> : (
            (() => {
              const vsMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
                approved: { label: "Aprovado", variant: "default" },
                pending: { label: "Pendente", variant: "outline" },
                employee_suggested: { label: "Sugerido", variant: "secondary" },
                rejected: { label: "Recusado", variant: "destructive" },
              };
              const sorted = [...data.vacations].sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
              const enjoyed = sorted.filter((v: any) => isVacationEnjoyed(v));
              const upcoming = sorted.filter((v: any) => !isVacationEnjoyed(v));
              const renderItem = (v: any) => {
                const vs = vsMap[v.status] || { label: v.status, variant: "outline" as const };
                return (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded-md border">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(v.start_date + "T00:00:00"), "dd/MM")} — {format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.days_count} dias · {v.year}</p>
                    </div>
                    <div className="flex gap-1">
                      {isVacationEnjoyed(v) && <Badge variant="default" className="text-xs">Gozado</Badge>}
                      <Badge variant={vs.variant} className="text-xs">{vs.label}</Badge>
                    </div>
                  </div>
                );
              };
              return (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {enjoyed.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gozadas ({enjoyed.length})</p>
                      {enjoyed.map(renderItem)}
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marcadas / Pendentes ({upcoming.length})</p>
                      {upcoming.map(renderItem)}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </SectionCard>

        {/* Meetings */}
        <SectionCard title="Reuniões" icon={CalendarCheck2} iconClass="text-primary" count={data.meetings.length}
          extra={meetingsCompleted > 0 ? `${meetingsPresent}/${meetingsCompleted} presente` : undefined}>
          {data.meetings.length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {data.meetings.map((m: any) => {
                const cfg = meetingStatusConfig[m.status] || meetingStatusConfig.scheduled;
                const Icon = cfg.icon;
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-md border">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(m.meeting_date), "dd/MM/yyyy")}{m.meeting_type && ` · ${m.meeting_type}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.status === "completed" && (
                        <Badge variant={m.present ? "default" : "destructive"} className="text-xs">{m.present ? "Presente" : "Ausente"}</Badge>
                      )}
                      <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Contracts */}
        <SectionCard title="Contratos" icon={Briefcase} iconClass="text-primary" count={data.contracts.length}>
          {data.contracts.length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {data.contracts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md border">
                  <div>
                    <p className="text-sm font-medium capitalize">{c.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.start_date + "T00:00:00"), "dd/MM/yyyy")}
                      {c.end_date ? ` — ${format(new Date(c.end_date + "T00:00:00"), "dd/MM/yyyy")}` : " — Indeterminado"}
                    </p>
                  </div>
                  <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">{c.is_active ? "Ativo" : "Inativo"}</Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Trainings */}
        <SectionCard title="Formações" icon={GraduationCap} iconClass="text-primary" count={(data.trainings || []).length}
          extra={trainingRemaining > 0 ? `${trainingHours}h/40h (${trainingRemaining}h restantes)` : `${trainingHours}h/40h ✓`}>
          {(data.trainings || []).length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {(data.trainings || []).map((t: any) => (
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
        </SectionCard>

        {/* EPIs */}
        <SectionCard title="EPIs" icon={HardHat} iconClass="text-primary" count={(data.epis || []).length}>
          {(data.epis || []).length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {(data.epis || []).map((epi: any) => (
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
        </SectionCard>

        {/* Ferramentas */}
        <SectionCard title="Ferramentas" icon={Wrench} iconClass="text-primary" count={(data.tools || []).filter((t: any) => t.status === "assigned").length}
          extra={`${(data.tools || []).filter((t: any) => t.status === "assigned").length} atribuídas`}>
          {(data.tools || []).length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {(data.tools || []).map((tool: any) => (
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
        </SectionCard>

        {/* Manutenções Realizadas */}
        <SectionCard title="Manutenções Realizadas" icon={Settings2} iconClass="text-primary" count={(data.maintenance_logs || []).length}>
          {(data.maintenance_logs || []).length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(data.maintenance_logs || []).map((log: any) => {
                const machine = log.machines || (data.maintenance_tasks || []).find((t: any) => t.id === log.task_id)?.machines;
                const template = machine?.checklist_template || [];
                const pct = calcPortalCompletion(log.checklist_data, template);
                return (
                  <div key={log.id} className="p-3 rounded-md border space-y-1 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setLogHistoryDetail({ log, template, machine })}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{format(new Date(log.completed_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                      <Badge variant={pct === 100 ? "default" : pct >= 50 ? "secondary" : "destructive"} className="text-xs">
                        {pct}%
                      </Badge>
                    </div>
                    {machine && <p className="text-xs text-muted-foreground">🔧 {machine.name}</p>}
                    {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Tarefas de Manutenção */}
        <SectionCard title="Tarefas de Manutenção" icon={ClipboardList} iconClass="text-primary" count={(data.maintenance_tasks || []).length}
          extra={`${(data.maintenance_tasks || []).length} ativas`}>
          {(data.maintenance_tasks || []).length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(data.maintenance_tasks || []).map((task: any) => {
                const freqLabel = freqMap[task.frequency] || task.frequency;
                let scheduleDetail = "";
                if (task.frequency === "weekly" && task.day_of_week != null) {
                  scheduleDetail = ` · ${DAYS_OF_WEEK[task.day_of_week]}`;
                } else if (task.frequency === "monthly" && task.day_of_month != null) {
                  scheduleDetail = ` · Dia ${task.day_of_month}`;
                }
                return (
                  <div key={task.id} className="p-3 rounded-md border space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{freqLabel}{scheduleDetail}</Badge>
                        <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => openMaintenanceDialog(task)}>
                          Registar
                        </Button>
                      </div>
                    </div>
                    {task.machines && (
                      <p className="text-xs text-muted-foreground">
                        🔧 {task.machines.name}{task.machines.location ? ` · ${task.machines.location}` : ""}
                      </p>
                    )}
                    {task.machines?.checklist_template && (task.machines.checklist_template as any[]).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        📋 {(task.machines.checklist_template as any[]).length} campos no checklist
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Pending Evaluations */}
        {pendingEvals.length > 0 && (
          <SectionCard title="Avaliações Pendentes" icon={ClipboardCheck} iconClass="text-primary" count={pendingEvals.length}>
            <div className="space-y-2">
              {pendingEvals.map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setActiveEval(ev); setEvalDialogOpen(true); }}>
                  <div>
                    <p className="text-sm font-medium">{ev.employee?.first_name} {ev.employee?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{ev.employee?.position}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Preencher</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Suggestion Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Sugestão / Avaliação</DialogTitle>
            <DialogDescription>Envie uma sugestão ou avalie a liderança. Pode ser anónimo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={suggestion.type} onValueChange={(v) => setSuggestion((s) => ({ ...s, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">💡 Sugestão</SelectItem>
                  <SelectItem value="leadership_evaluation">⭐ Avaliação de Liderança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {suggestion.type === "leadership_evaluation" && (
              <>
              <div className="space-y-2">
                <Label>Líder a avaliar *</Label>
                <Select
                  value={suggestion.evaluated_leader_id || undefined}
                  onValueChange={(v) => setSuggestion((s) => ({ ...s, evaluated_leader_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o líder" /></SelectTrigger>
                  <SelectContent>
                    {(data?.leaders || []).map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.first_name} {l.last_name}{l.position ? ` — ${l.position}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Classificação</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setSuggestion((s) => ({ ...s, rating: n }))}
                      className="p-1 hover:scale-110 transition-transform">
                      <Star className={`h-6 w-6 ${n <= suggestion.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea placeholder={suggestion.type === "suggestion" ? "Escreva a sua sugestão..." : "Descreva a sua avaliação..."} value={suggestion.message} onChange={(e) => setSuggestion((s) => ({ ...s, message: e.target.value }))} rows={4} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enviar anonimamente</p>
                <p className="text-xs text-muted-foreground">O seu nome não será associado</p>
              </div>
              <Switch checked={suggestion.is_anonymous} onCheckedChange={(v) => setSuggestion((s) => ({ ...s, is_anonymous: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitSuggestion} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Form Dialog */}
      <Dialog open={evalDialogOpen} onOpenChange={(v) => { if (!v) { setEvalDialogOpen(false); setActiveEval(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Avaliar Funcionário</DialogTitle>
            <DialogDescription>
              {activeEval?.employee && `${activeEval.employee.first_name} ${activeEval.employee.last_name} — ${activeEval.employee.position}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {[
              { key: "rating", label: "Nota Geral *" },
              { key: "performance_rating", label: "Desempenho" },
              { key: "teamwork_rating", label: "Trabalho em Equipa" },
              { key: "punctuality_rating", label: "Pontualidade" },
              { key: "communication_rating", label: "Comunicação" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setEvalForm((f) => ({ ...f, [key]: n }))}
                      className="p-1 hover:scale-110 transition-transform">
                      <Star className={`h-5 w-5 ${n <= (evalForm as any)[key] ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Separator />
            <div className="space-y-2">
              <Label>Pontos Fortes</Label>
              <Textarea value={evalForm.strengths} onChange={(e) => setEvalForm((f) => ({ ...f, strengths: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Pontos a Melhorar</Label>
              <Textarea value={evalForm.improvements} onChange={(e) => setEvalForm((f) => ({ ...f, improvements: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Comentários</Label>
              <Textarea value={evalForm.comments} onChange={(e) => setEvalForm((f) => ({ ...f, comments: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEvalDialogOpen(false); setActiveEval(null); }}>Cancelar</Button>
            <Button onClick={handleSubmitEvaluation} disabled={evalSubmitting}>
              {evalSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submeter Avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Log Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={(v) => { if (!v) { setMaintenanceDialogOpen(false); setActiveTask(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Registar Manutenção</DialogTitle>
            <DialogDescription>
              {activeTask?.title}{activeTask?.machines ? ` — ${activeTask.machines.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeTask?.machines?.checklist_template && (activeTask.machines.checklist_template as any[]).length > 0 ? (
              (activeTask.machines.checklist_template as any[]).map((field: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <Label>{field.label || field.name}</Label>
                  {field.type === "checkbox" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!checklistData[field.name]}
                        onCheckedChange={(v) => setChecklistData((d) => ({ ...d, [field.name]: !!v }))}
                      />
                      <span className="text-sm">Sim</span>
                    </div>
                  ) : field.type === "select" ? (
                    <Select value={checklistData[field.name] || ""} onValueChange={(v) => setChecklistData((d) => ({ ...d, [field.name]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((opt: string) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "number" ? (
                    <Input type="number" value={checklistData[field.name] || ""} onChange={(e) => setChecklistData((d) => ({ ...d, [field.name]: e.target.value }))} />
                  ) : (
                    <Input value={checklistData[field.name] || ""} onChange={(e) => setChecklistData((d) => ({ ...d, [field.name]: e.target.value }))} />
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Esta máquina não tem checklist configurado.</p>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} rows={3} placeholder="Notas adicionais..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMaintenanceDialogOpen(false); setActiveTask(null); }}>Cancelar</Button>
            <Button onClick={handleSubmitMaintenanceLog} disabled={maintenanceSubmitting}>
              {maintenanceSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Registar Manutenção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance History Detail Dialog */}
      <Dialog open={!!logHistoryDetail} onOpenChange={(v) => !v && setLogHistoryDetail(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes da Manutenção</DialogTitle>
            <DialogDescription>
              {logHistoryDetail?.log && format(new Date(logHistoryDetail.log.completed_date + "T00:00:00"), "dd/MM/yyyy")}
              {logHistoryDetail?.machine && ` — ${logHistoryDetail.machine.name}`}
            </DialogDescription>
          </DialogHeader>
          {logHistoryDetail && (() => {
            const { log, template } = logHistoryDetail;
            const pct = calcPortalCompletion(log.checklist_data, template);
            return (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Conclusão</span>
                    <Badge variant={pct === 100 ? "default" : pct >= 50 ? "secondary" : "destructive"}>{pct}%</Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {Array.isArray(template) && template.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Checklist</p>
                    {template.map((field: any, idx: number) => {
                      const val = log.checklist_data?.[field.name];
                      const isCheck = field.type === "checkbox";
                      const done = isCheck ? val === true : val !== undefined && val !== null && val !== "";
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-md border text-sm">
                          <span>{field.label || field.name}</span>
                          {isCheck ? (
                            <Badge variant={done ? "default" : "destructive"} className="text-xs">{done ? "✓ Sim" : "✗ Não"}</Badge>
                          ) : (
                            <span className="font-medium text-sm">{done ? String(val) : <Badge variant="destructive" className="text-xs">Não preenchido</Badge>}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {log.notes && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Observações</p>
                    <p className="text-sm text-muted-foreground">{log.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components
function SummaryCard({ icon: Icon, iconClass, bgClass, value, label }: any) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgClass}`}>
          <Icon className={`h-5 w-5 ${iconClass}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, iconClass, count, extra, children }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          {title}
          <Badge variant="secondary" className="ml-auto text-xs">{extra || `${count} total`}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
    </div>
  );
}

function EmptyText() {
  return <p className="text-sm text-muted-foreground">Sem registos.</p>;
}
