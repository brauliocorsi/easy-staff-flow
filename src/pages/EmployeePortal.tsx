import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Lock, AlertTriangle, CheckCircle, XCircle, Palmtree,
  CalendarCheck2, Play, CheckCircle2, FileText, Briefcase, Star,
  MessageSquarePlus, User, Mail, Phone, Calendar, MapPin, Hash,
  ClipboardCheck, GraduationCap
} from "lucide-react";
import { format } from "date-fns";
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
      setSuggestion({ type: "suggestion", message: "", rating: 0, is_anonymous: false });
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
  const vacEnjoyed = curVac.reduce((s: number, v: any) => s + (v.enjoyed ? v.days_count : 0), 0);
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard icon={AlertTriangle} iconClass="text-destructive" bgClass="bg-destructive/10" value={unjustified} label="Faltas Injustif." />
          <SummaryCard icon={FileText} iconClass="text-destructive" bgClass="bg-destructive/10" value={data.warnings.length} label="Advertências" />
          <SummaryCard icon={Palmtree} iconClass="text-primary" bgClass="bg-primary/10" value={`${vacEnjoyed}/${vacEntitled}`} label="Férias Gozadas" />
          <SummaryCard icon={CalendarCheck2} iconClass="text-primary" bgClass="bg-primary/10" value={data.meetings.length} label="Reuniões" />
          <SummaryCard icon={GraduationCap} iconClass="text-primary" bgClass="bg-primary/10" value={`${trainingHours}h/40h`} label="Formação" />
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

        {/* Absences */}
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
        <SectionCard title="Férias" icon={Palmtree} iconClass="text-primary" count={data.vacations.length}>
          {data.vacations.length === 0 ? <EmptyText /> : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {data.vacations.map((v: any) => {
                const vsMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
                  approved: { label: "Aprovado", variant: "default" },
                  pending: { label: "Pendente", variant: "outline" },
                  employee_suggested: { label: "Sugerido", variant: "secondary" },
                  rejected: { label: "Recusado", variant: "destructive" },
                };
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
                      {v.enjoyed && <Badge variant="default" className="text-xs">Gozado</Badge>}
                      <Badge variant={vs.variant} className="text-xs">{vs.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
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
