import { useMemo, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Lock, AlertTriangle, Palmtree, CalendarCheck2, FileText, Star,
  MessageSquarePlus, User, Mail, Phone, Calendar, Briefcase, GraduationCap,
  Clock, LogOut, TrendingUp, TrendingDown, Sparkles, Printer, ClipboardList,
  Wrench, HardHat, ShieldCheck, ChevronRight,
} from "lucide-react";
import { isVacationEnjoyed } from "@/lib/vacationStatus";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { generateVacationMapPdf } from "@/lib/generateVacationMapPdf";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const freqMap: Record<string, string> = { daily: "Diária", weekly: "Semanal", monthly: "Mensal" };

function formatMinutes(mins: number) {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${hh}h${String(mm).padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 19) return "Boa tarde";
  return "Boa noite";
}

function calcPortalCompletion(checklistData: any, template: any[]): number {
  if (!Array.isArray(template) || template.length === 0) return 100;
  let done = 0;
  for (const field of template) {
    const val = checklistData?.[field.name];
    if (field.type === "checkbox") { if (val === true) done++; }
    else if (val !== undefined && val !== null && val !== "") done++;
  }
  return Math.round((done / template.length) * 100);
}

export default function EmployeePortal() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // Leader evaluation
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalForm, setEvalForm] = useState({
    evaluated_leader_id: "",
    rating: 0,
    strengths: "",
    improvements: "",
    message: "",
    is_anonymous: true,
  });

  // Suggestion
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [suggestForm, setSuggestForm] = useState({ message: "", is_anonymous: true });

  // Maintenance
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [checklistData, setChecklistData] = useState<Record<string, any>>({});
  const [maintenanceNotes, setMaintenanceNotes] = useState("");

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
      // Pre-select manager if known
      const managerId = res?.employee?.manager_id;
      if (managerId) setEvalForm((f) => ({ ...f, evaluated_leader_id: managerId }));
    } catch (err: any) {
      toast.error(err.message || "PIN inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!evalForm.evaluated_leader_id) { toast.error("Selecione o seu líder"); return; }
    if (evalForm.rating === 0) { toast.error("Atribua uma classificação"); return; }
    setEvalSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("employee-portal", {
        body: {
          action: "submit_suggestion",
          employee_id: data?.employee?.id,
          suggestion: {
            type: "leadership_evaluation",
            evaluated_leader_id: evalForm.evaluated_leader_id,
            rating: evalForm.rating,
            is_anonymous: evalForm.is_anonymous,
            message: [
              evalForm.strengths && `Pontos fortes: ${evalForm.strengths}`,
              evalForm.improvements && `A melhorar: ${evalForm.improvements}`,
              evalForm.message && `Comentário: ${evalForm.message}`,
            ].filter(Boolean).join("\n\n") || "Avaliação de liderança submetida.",
          },
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success("Avaliação enviada. Obrigado!");
      setEvalOpen(false);
      setEvalForm({
        evaluated_leader_id: data?.employee?.manager_id || "",
        rating: 0, strengths: "", improvements: "", message: "", is_anonymous: true,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setEvalSubmitting(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestForm.message.trim()) { toast.error("Escreva uma mensagem"); return; }
    setSuggestSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("employee-portal", {
        body: {
          action: "submit_suggestion",
          employee_id: data?.employee?.id,
          suggestion: {
            type: "suggestion",
            message: suggestForm.message,
            is_anonymous: suggestForm.is_anonymous,
          },
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success("Sugestão enviada!");
      setSuggestOpen(false);
      setSuggestForm({ message: "", is_anonymous: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setSuggestSubmitting(false);
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
      toast.success("Manutenção registada!");
      setMaintenanceDialogOpen(false);
      setActiveTask(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar manutenção");
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  // ===== Login screen =====
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-xl border-primary/10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/70 w-fit shadow-lg">
              <Lock className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">Portal do Funcionário</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Insira o seu PIN de 4 dígitos</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pb-6">
            <InputOTP maxLength={4} value={pin} onChange={setPin} onComplete={() => handleLogin()}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" size="lg" onClick={handleLogin} disabled={pin.length !== 4 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== Dashboard =====
  const emp = data.employee;
  const initials = `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const unjustifiedMonth = (data.absences || []).filter((a: any) => {
    if (a.justified) return false;
    const d = new Date(a.absence_date + "T00:00:00");
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }).length;

  const curVac = (data.vacations || []).filter((v: any) => v.year === currentYear);
  const vacEnjoyed = curVac.reduce((s: number, v: any) => s + (isVacationEnjoyed(v) ? v.days_count : 0), 0);
  const vacEntitled = curVac[0]?.total_entitled_days || 22;
  const vacScheduled = curVac.reduce((s: number, v: any) => s + (!isVacationEnjoyed(v) ? v.days_count : 0), 0);

  const curTrainings = (data.trainings || []).filter((t: any) => t.year === currentYear);
  const trainingHours = curTrainings.reduce((s: number, t: any) => s + Number(t.hours), 0);
  const trainingPct = Math.min(100, Math.round((trainingHours / 40) * 100));

  const activeWarnings = (data.warnings || []).length;
  const _now = new Date();
  const upcomingMeeting = (data.meetings || [])
    .filter((m: any) => new Date(m.meeting_date) >= _now && m.status !== "completed")
    .sort((a: any, b: any) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())[0];

  const recentPunches = (data.time_clock_records || []).slice(0, 7);

  const bankAccumulated = Number(
    data.time_bank_accumulated_minutes ?? data.time_bank_balance_minutes ?? 0,
  );
  const bankMonth = Number(data.time_bank_month_minutes ?? 0);
  const bankPositive = bankAccumulated >= 0;

  const leaders = (data.leaders || []).filter((l: any) => l.id !== emp.id);

  const hasMaintenance = (data.maintenance_tasks || []).length > 0;
  const docsCount =
    (data.contracts || []).length +
    (data.epis || []).length +
    (data.tools || []).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-background">
      {/* Header / Hero */}
      <div className="relative overflow-hidden border-b bg-gradient-to-r from-primary/15 via-primary/5 to-accent/10">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.25), transparent 40%), radial-gradient(circle at 80% 60%, hsl(var(--accent)/0.25), transparent 40%)" }} />
        <div className="relative max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-4 ring-background shadow-lg">
              <AvatarImage src={emp.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {greeting()} · {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
              </p>
              <h1 className="font-display font-bold text-2xl leading-tight">{emp.first_name} {emp.last_name}</h1>
              <p className="text-sm text-muted-foreground">
                {emp.position}{emp.departments?.name ? ` · ${emp.departments.name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setEvalOpen(true)} className="gap-2 shadow-md">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Avaliar o meu Líder</span>
              <span className="sm:hidden">Avaliar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setData(null); setPin(""); }}>
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Time Bank Hero */}
        <Card className={`border-2 ${bankPositive ? "border-primary/30" : "border-destructive/30"} shadow-md overflow-hidden`}>
          <div className={`absolute inset-x-0 top-0 h-1 ${bankPositive ? "bg-primary" : "bg-destructive"}`} />
          <CardContent className="pt-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${bankPositive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Saldo Acumulado</p>
                <p className={`font-display font-bold text-4xl leading-none mt-1 ${bankPositive ? "text-primary" : "text-destructive"}`}>
                  {formatMinutes(bankAccumulated)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {bankPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {bankPositive ? "Banco equilibrado ou a favor" : "Saldo a recuperar"}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Inclui meses já fechados
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={bankPositive ? "default" : "destructive"} className="text-xs">
                {bankPositive ? "Saldo positivo" : "Saldo negativo"}
              </Badge>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Este mês</p>
                <p className={`font-display font-semibold text-lg leading-none mt-0.5 ${bankMonth >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatMinutes(bankMonth)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={AlertTriangle}
            tone={unjustifiedMonth > 0 ? "destructive" : "muted"}
            value={unjustifiedMonth}
            label="Faltas no mês"
            hint={unjustifiedMonth > 0 ? "Injustificadas" : "Tudo em ordem"}
          />
          <KpiCard
            icon={Palmtree}
            tone="primary"
            value={`${vacEnjoyed}/${vacEntitled}`}
            label={`Férias ${currentYear}`}
            hint={vacScheduled > 0 ? `${vacScheduled} marcadas` : "Sem marcações"}
          />
          <KpiCard
            icon={GraduationCap}
            tone={trainingPct >= 100 ? "primary" : "accent"}
            value={`${trainingHours}h`}
            label="Formação / 40h"
            progress={trainingPct}
          />
          <KpiCard
            icon={activeWarnings > 0 ? FileText : CalendarCheck2}
            tone={activeWarnings > 0 ? "destructive" : "primary"}
            value={activeWarnings > 0 ? activeWarnings : (upcomingMeeting ? "•" : 0)}
            label={activeWarnings > 0 ? "Advertências" : "Próx. reunião"}
            hint={activeWarnings > 0
              ? "Total"
              : (upcomingMeeting ? format(new Date(upcomingMeeting.meeting_date), "dd/MM HH:mm") : "Sem agendamentos")}
          />
        </div>

        {/* Personal info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={Mail} label="Email" value={emp.email} />
            <InfoRow icon={Phone} label="Telefone" value={emp.phone || "—"} />
            <InfoRow icon={Calendar} label="Admissão" value={emp.hire_date ? format(new Date(emp.hire_date + "T00:00:00"), "dd/MM/yyyy") : "—"} />
            <InfoRow icon={Briefcase} label="Departamento" value={emp.departments?.name || "—"} />
          </CardContent>
        </Card>

        {/* Punches */}
        <SectionCard title="Últimos Pontos" icon={Clock} count={recentPunches.length} extra="últimos 7 dias">
          {recentPunches.length === 0 ? <EmptyText /> : (
            <div className="space-y-2">
              {recentPunches.map((r: any) => {
                const fmtTime = (ts: string | null) => {
                  if (!ts) return "—";
                  const d = new Date(ts);
                  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                };
                const hasAll = r.clock_in && r.clock_out;
                return (
                  <div key={r.id} className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{format(new Date(r.record_date + "T00:00:00"), "EEEE, dd/MM", { locale: pt })}</p>
                      <Badge variant={hasAll ? "default" : "outline"} className="text-xs">
                        {hasAll ? "Completo" : "Parcial"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Entrada <strong className="text-foreground">{fmtTime(r.clock_in)}</strong></span>
                      <span>Almoço <strong className="text-foreground">{fmtTime(r.lunch_out)}</strong></span>
                      <span>Retorno <strong className="text-foreground">{fmtTime(r.lunch_in)}</strong></span>
                      <span>Saída <strong className="text-foreground">{fmtTime(r.clock_out)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Absences */}
        <SectionCard title="Faltas" icon={AlertTriangle} tone="destructive" count={(data.absences || []).length}>
          {(data.absences || []).length === 0
            ? <EmptyText label="Nenhuma falta registada." />
            : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {data.absences.slice(0, 20).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{format(new Date(a.absence_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                      {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
                    </div>
                    <Badge variant={a.justified ? "outline" : "destructive"} className="text-xs">
                      {a.justified ? "Justificada" : "Injustificada"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Vacations */}
        <SectionCard
          title="Férias"
          icon={Palmtree}
          tone="primary"
          count={curVac.length}
          extra={`${vacEnjoyed}/${vacEntitled} gozados em ${currentYear}`}
        >
          {(() => {
            const deptName: string | undefined = emp.departments?.name;
            const sectorScope = deptName === "Fábrica" ? "factory" : deptName === "Armazém" ? "warehouse" : null;
            const sectorVacs = data.sector_vacations || [];
            if (!sectorScope || sectorVacs.length === 0) return null;
            return (
              <div className="mb-3 flex items-center justify-between p-2 rounded-md bg-muted/50 border">
                <div className="text-xs text-muted-foreground">
                  Mapa do setor <strong>{deptName}</strong> ({currentYear})
                </div>
                <Button variant="outline" size="sm"
                  onClick={() => generateVacationMapPdf(sectorVacs, currentYear, sectorScope as any)}>
                  <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                </Button>
              </div>
            );
          })()}
          {curVac.length === 0 ? <EmptyText label="Sem férias marcadas." /> : (() => {
            const sorted = [...curVac].sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
            const enjoyed = sorted.filter((v: any) => isVacationEnjoyed(v));
            const upcoming = sorted.filter((v: any) => !isVacationEnjoyed(v));
            const renderItem = (v: any) => (
              <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">
                    {format(new Date(v.start_date + "T00:00:00"), "dd/MM")} — {format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">{v.days_count} dias</p>
                </div>
                {isVacationEnjoyed(v)
                  ? <Badge variant="default" className="text-xs">Gozado</Badge>
                  : <Badge variant="outline" className="text-xs">Marcado</Badge>}
              </div>
            );
            return (
              <div className="space-y-3">
                {upcoming.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marcadas ({upcoming.length})</p>
                    {upcoming.map(renderItem)}
                  </div>
                )}
                {enjoyed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Já gozadas ({enjoyed.length})</p>
                    {enjoyed.map(renderItem)}
                  </div>
                )}
              </div>
            );
          })()}
        </SectionCard>

        {/* Trainings */}
        <SectionCard title="Formação" icon={GraduationCap} tone="primary" count={curTrainings.length}
          extra={`${trainingHours}h / 40h`}>
          <div className="mb-3">
            <Progress value={trainingPct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {trainingPct >= 100 ? "Objetivo anual atingido ✓" : `${40 - trainingHours}h restantes em ${currentYear}`}
            </p>
          </div>
          {curTrainings.length === 0 ? <EmptyText label="Sem formações este ano." /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {curTrainings.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.training_date + "T00:00:00"), "dd/MM/yyyy")} · {t.hours}h
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

        {/* Warnings — only if any */}
        {activeWarnings > 0 && (
          <SectionCard title="Advertências" icon={FileText} tone="destructive" count={activeWarnings}>
            <div className="space-y-2">
              {data.warnings.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{w.reason}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(w.warning_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">{w.type}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Meetings — only upcoming + last 3 completed */}
        {(() => {
          const now = new Date();
          const upcoming = (data.meetings || []).filter((m: any) => new Date(m.meeting_date) >= now && m.status !== "completed")
            .sort((a: any, b: any) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());
          const past = (data.meetings || []).filter((m: any) => m.status === "completed").slice(0, 3);
          const shown = [...upcoming, ...past];
          if (shown.length === 0) return null;
          return (
            <SectionCard title="Reuniões" icon={CalendarCheck2} tone="primary" count={shown.length}>
              <div className="space-y-2">
                {shown.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(m.meeting_date), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    {m.status === "completed"
                      ? <Badge variant={m.present ? "default" : "destructive"} className="text-xs">{m.present ? "Presente" : "Ausente"}</Badge>
                      : <Badge variant="outline" className="text-xs">Agendada</Badge>}
                  </div>
                ))}
              </div>
            </SectionCard>
          );
        })()}

        {/* Documents & Equipment summary */}
        {docsCount > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Documentos & Equipamentos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <MiniStat icon={Briefcase} value={(data.contracts || []).length} label="Contratos" />
              <MiniStat icon={HardHat} value={(data.epis || []).length} label="EPIs" />
              <MiniStat icon={Wrench} value={(data.tools || []).filter((t: any) => t.status === "assigned").length} label="Ferramentas" />
            </CardContent>
            <div className="px-6 pb-4 -mt-2">
              <p className="text-xs text-muted-foreground text-center">Fale com o RH para detalhes ou novas entregas.</p>
            </div>
          </Card>
        )}

        {/* Maintenance tasks — only if any */}
        {hasMaintenance && (
          <SectionCard title="Tarefas de Manutenção" icon={ClipboardList} tone="primary" count={(data.maintenance_tasks || []).length}>
            <div className="space-y-2">
              {(data.maintenance_tasks || []).map((task: any) => {
                const freqLabel = freqMap[task.frequency] || task.frequency;
                let scheduleDetail = "";
                if (task.frequency === "weekly" && task.day_of_week != null) scheduleDetail = ` · ${DAYS_OF_WEEK[task.day_of_week]}`;
                else if (task.frequency === "monthly" && task.day_of_month != null) scheduleDetail = ` · Dia ${task.day_of_month}`;
                return (
                  <div key={task.id} className="flex items-center justify-between p-2.5 rounded-lg border gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.machines?.name}{task.machines?.location ? ` · ${task.machines.location}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">{freqLabel}{scheduleDetail}</Badge>
                      <Button size="sm" className="h-7 text-xs" onClick={() => openMaintenanceDialog(task)}>Registar</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Footer suggestion link */}
        <div className="text-center pt-4 pb-8">
          <button
            type="button"
            onClick={() => setSuggestOpen(true)}
            className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Enviar uma sugestão à empresa
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Leader Evaluation Dialog */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Avaliar o meu Líder
            </DialogTitle>
            <DialogDescription>
              A sua opinião ajuda a melhorar a liderança. Pode enviar de forma anónima.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Líder a avaliar *</Label>
              <Select
                value={evalForm.evaluated_leader_id || undefined}
                onValueChange={(v) => setEvalForm((f) => ({ ...f, evaluated_leader_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o líder" /></SelectTrigger>
                <SelectContent>
                  {leaders.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.first_name} {l.last_name}{l.position ? ` — ${l.position}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Classificação *</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setEvalForm((f) => ({ ...f, rating: n }))}
                    className="p-1 hover:scale-110 transition-transform">
                    <Star className={`h-7 w-7 ${n <= evalForm.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pontos fortes</Label>
              <Textarea rows={2} value={evalForm.strengths}
                onChange={(e) => setEvalForm((f) => ({ ...f, strengths: e.target.value }))}
                placeholder="O que faz bem..." />
            </div>
            <div className="space-y-2">
              <Label>A melhorar</Label>
              <Textarea rows={2} value={evalForm.improvements}
                onChange={(e) => setEvalForm((f) => ({ ...f, improvements: e.target.value }))}
                placeholder="Sugestões de melhoria..." />
            </div>
            <div className="space-y-2">
              <Label>Comentário adicional</Label>
              <Textarea rows={2} value={evalForm.message}
                onChange={(e) => setEvalForm((f) => ({ ...f, message: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Enviar anonimamente</p>
                <p className="text-xs text-muted-foreground">O seu nome não será associado</p>
              </div>
              <Switch checked={evalForm.is_anonymous}
                onCheckedChange={(v) => setEvalForm((f) => ({ ...f, is_anonymous: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitEvaluation} disabled={evalSubmitting}>
              {evalSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggestion Dialog */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Enviar Sugestão</DialogTitle>
            <DialogDescription>Partilhe ideias para melhorar a empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea rows={5} value={suggestForm.message}
                onChange={(e) => setSuggestForm((s) => ({ ...s, message: e.target.value }))}
                placeholder="Escreva a sua sugestão..." />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Enviar anonimamente</p>
                <p className="text-xs text-muted-foreground">O seu nome não será associado</p>
              </div>
              <Switch checked={suggestForm.is_anonymous}
                onCheckedChange={(v) => setSuggestForm((s) => ({ ...s, is_anonymous: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitSuggestion} disabled={suggestSubmitting}>
              {suggestSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar
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
                      <Checkbox checked={!!checklistData[field.name]}
                        onCheckedChange={(v) => setChecklistData((d) => ({ ...d, [field.name]: !!v }))} />
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
              Registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Helper components =====
const toneMap = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive" },
  accent: { bg: "bg-accent", text: "text-accent-foreground" },
  muted: { bg: "bg-muted", text: "text-muted-foreground" },
} as const;

type Tone = keyof typeof toneMap;

function KpiCard({ icon: Icon, tone = "primary", value, label, hint, progress }: {
  icon: any; tone?: Tone; value: any; label: string; hint?: string; progress?: number;
}) {
  const t = toneMap[tone];
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`p-2 rounded-lg ${t.bg}`}>
            <Icon className={`h-5 w-5 ${t.text}`} />
          </div>
        </div>
        <p className="font-display text-2xl font-bold mt-3 leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</p>}
        {typeof progress === "number" && <Progress value={progress} className="h-1 mt-2" />}
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, tone = "primary", count, extra, children }: {
  title: string; icon: any; tone?: Tone; count?: number; extra?: string; children: React.ReactNode;
}) {
  const t = toneMap[tone];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${t.text}`} />
          {title}
          <Badge variant="secondary" className="ml-auto text-xs">{extra || (count != null ? `${count} total` : "")}</Badge>
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
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, value, label }: any) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyText({ label = "Sem registos." }: { label?: string }) {
  return <p className="text-sm text-muted-foreground text-center py-3">{label}</p>;
}
