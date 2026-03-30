import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Loader2, CalendarIcon, Upload, Trash2, FileText, AlertTriangle, CheckCircle, ArrowRightLeft, Timer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function Absences() {
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [justifyOpen, setJustifyOpen] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [swapAbsence, setSwapAbsence] = useState<any | null>(null);
  const [bankAbsence, setBankAbsence] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedType, setSelectedType] = useState("unjustified");
  const queryClient = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const { data: absences, isLoading } = useQuery({
    queryKey: ["absences", search],
    queryFn: async () => {
      let query = supabase
        .from("absences")
        .select("*, employees(first_name, last_name, position)")
        .order("absence_date", { ascending: false });

      if (search) {
        // We filter client-side for employee name search
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.filter((a: any) => {
        if (!search) return true;
        const name = `${a.employees?.first_name} ${a.employees?.last_name}`.toLowerCase();
        return name.includes(search.toLowerCase());
      });
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-active-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee || !selectedDate) throw new Error("Campos obrigatórios");
      const { error } = await supabase.from("absences").insert({
        employee_id: selectedEmployee,
        absence_date: format(selectedDate, "yyyy-MM-dd"),
        type: selectedType,
        reason: reason || null,
        auto_detected: false,
        justified: selectedType === "justified",
        justification_date: selectedType === "justified" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Falta registrada");
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setRegisterOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const justifyMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!reason.trim()) throw new Error("Motivo obrigatório");
      const { error } = await supabase
        .from("absences")
        .update({
          justified: true,
          type: "justified",
          reason,
          justification_date: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Falta justificada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setJustifyOpen(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Falta removida");
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const swapMutation = useMutation({
    mutationFn: async (absence: any) => {
      const { error: vacError } = await supabase.from("vacation_requests").insert({
        employee_id: absence.employee_id,
        start_date: absence.absence_date,
        end_date: absence.absence_date,
        days_count: 1,
        total_entitled_days: 0,
        category: "individual",
        year: new Date(absence.absence_date).getFullYear(),
        status: "approved",
        admin_confirmed: true,
        enjoyed: true,
        notes: "Troca de falta por dia de férias",
      });
      if (vacError) throw vacError;

      const { error: absError } = await supabase
        .from("absences")
        .update({
          justified: true,
          type: "vacation_swap",
          reason: "Trocada por 1 dia de férias",
          justification_date: new Date().toISOString(),
        })
        .eq("id", absence.id);
      if (absError) throw absError;
    },
    onSuccess: () => {
      toast.success("Falta trocada por dia de férias com sucesso");
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["vacation_requests"] });
      queryClient.invalidateQueries({ queryKey: ["employee_vacations"] });
      setSwapAbsence(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bankDeductMutation = useMutation({
    mutationFn: async (absence: any) => {
      // 1. Get employee schedule template
      const { data: emp } = await supabase
        .from("employees")
        .select("schedule_template_id")
        .eq("id", absence.employee_id)
        .single();
      if (!emp?.schedule_template_id) throw new Error("Funcionário sem modelo de horário definido");

      // 2. Get schedule for the absence day
      const absDate = new Date(absence.absence_date + "T12:00:00");
      const dow = absDate.getDay();
      const { data: schedDay } = await supabase
        .from("schedule_template_days")
        .select("*")
        .eq("template_id", emp.schedule_template_id)
        .eq("day_of_week", dow)
        .single();
      if (!schedDay || schedDay.is_day_off) throw new Error("Este dia é folga, não pode ser abatido");

      const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
      const scheduledWork = timeToMin(schedDay.clock_out_time) - timeToMin(schedDay.clock_in_time)
        - (timeToMin(schedDay.lunch_in_time) - timeToMin(schedDay.lunch_out_time));

      // 3. Calculate current month balance
      const monthStart = format(new Date(absDate.getFullYear(), absDate.getMonth(), 1), "yyyy-MM-dd");
      const monthEnd = format(new Date(absDate.getFullYear(), absDate.getMonth() + 1, 0), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");

      const [recordsRes, templateDaysRes, templateRes, bankAbsRes] = await Promise.all([
        supabase.from("time_clock_records").select("*").eq("employee_id", absence.employee_id).gte("record_date", monthStart).lte("record_date", monthEnd),
        supabase.from("schedule_template_days").select("*").eq("template_id", emp.schedule_template_id),
        supabase.from("schedule_templates").select("tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes").eq("id", emp.schedule_template_id).single(),
        supabase.from("absences").select("absence_date").eq("employee_id", absence.employee_id).eq("deducted_from_bank", true).gte("absence_date", monthStart).lte("absence_date", monthEnd),
      ]);

      const records = recordsRes.data || [];
      const templateDays = templateDaysRes.data || [];
      const tolerances = templateRes.data || { tolerance_late_minutes: 10, tolerance_overtime_minutes: 15, tolerance_early_leave_minutes: 5 };
      const bankDates = new Set((bankAbsRes.data || []).map((a: any) => a.absence_date));

      const schedMap = new Map<number, any>();
      templateDays.forEach((td: any) => schedMap.set(td.day_of_week, td));
      const recMap = new Map<string, any>();
      records.forEach((r: any) => recMap.set(r.record_date, r));

      const tsToMin = (ts: string) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };

      const days: Date[] = [];
      const start = new Date(absDate.getFullYear(), absDate.getMonth(), 1);
      const end = new Date(absDate.getFullYear(), absDate.getMonth() + 1, 0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (format(d, "yyyy-MM-dd") <= today) days.push(new Date(d));
      }

      let balance = 0;
      for (const d of days) {
        const dateStr = format(d, "yyyy-MM-dd");
        const dw = d.getDay();
        const sched = schedMap.get(dw);
        const rec = recMap.get(dateStr);
        const isBankDed = bankDates.has(dateStr);

        if (isBankDed && sched && !sched.is_day_off) {
          const sw = timeToMin(sched.clock_out_time) - timeToMin(sched.clock_in_time)
            - (timeToMin(sched.lunch_in_time) - timeToMin(sched.lunch_out_time));
          balance -= sw;
          continue;
        }
        if (!sched || sched.is_day_off) {
          if (rec?.clock_in && rec?.clock_out) {
            let w = tsToMin(rec.clock_out) - tsToMin(rec.clock_in);
            if (rec.lunch_out && rec.lunch_in) w -= tsToMin(rec.lunch_in) - tsToMin(rec.lunch_out);
            balance += w;
          }
          continue;
        }
        if (!rec || !rec.clock_in || !rec.clock_out) continue;

        const isPartTime = sched.lunch_in_time === "00:00:00" && sched.clock_out_time === "00:00:00";
        if (isPartTime) {
          const actual = tsToMin(rec.lunch_out || rec.clock_out) - tsToMin(rec.clock_in);
          const expected = timeToMin(sched.lunch_out_time) - timeToMin(sched.clock_in_time);
          let diff = actual - expected;
          if (diff > 0 && diff <= tolerances.tolerance_overtime_minutes) diff = 0;
          else if (diff > tolerances.tolerance_overtime_minutes) diff -= tolerances.tolerance_overtime_minutes;
          if (diff < 0 && Math.abs(diff) <= tolerances.tolerance_late_minutes) diff = 0;
          balance += diff;
        } else {
          // Entry
          let entryDiff = timeToMin(sched.clock_in_time) - tsToMin(rec.clock_in);
          if (entryDiff > 0 && entryDiff <= tolerances.tolerance_overtime_minutes) entryDiff = 0;
          else if (entryDiff > tolerances.tolerance_overtime_minutes) entryDiff -= tolerances.tolerance_overtime_minutes;
          if (entryDiff < 0 && Math.abs(entryDiff) <= tolerances.tolerance_late_minutes) entryDiff = 0;

          // Lunch
          let lunchDiff = 0;
          if (rec.lunch_out && rec.lunch_in) {
            const actualLunch = tsToMin(rec.lunch_in) - tsToMin(rec.lunch_out);
            const schedLunch = timeToMin(sched.lunch_in_time) - timeToMin(sched.lunch_out_time);
            lunchDiff = actualLunch - schedLunch;
            if (lunchDiff > 0 && lunchDiff <= tolerances.tolerance_late_minutes) lunchDiff = 0;
            if (lunchDiff < 0) lunchDiff = 0; // shorter lunch doesn't generate credit
          }

          // Exit
          let exitDiff = tsToMin(rec.clock_out) - timeToMin(sched.clock_out_time);
          if (exitDiff > 0 && exitDiff <= tolerances.tolerance_overtime_minutes) exitDiff = 0;
          else if (exitDiff > tolerances.tolerance_overtime_minutes) exitDiff -= tolerances.tolerance_overtime_minutes;
          if (exitDiff < 0 && Math.abs(exitDiff) <= tolerances.tolerance_early_leave_minutes) exitDiff = 0;

          balance += entryDiff - lunchDiff + exitDiff;
        }
      }

      // 4. Check if balance is sufficient
      if (balance < scheduledWork) {
        const balH = Math.floor(Math.abs(balance) / 60);
        const balM = Math.abs(balance) % 60;
        const needH = Math.floor(scheduledWork / 60);
        const needM = scheduledWork % 60;
        throw new Error(
          `Saldo insuficiente no banco de horas. Saldo atual: ${balance < 0 ? "-" : ""}${String(balH).padStart(2, "0")}:${String(balM).padStart(2, "0")}. Necessário: ${String(needH).padStart(2, "0")}:${String(needM).padStart(2, "0")}.`
        );
      }

      // 5. Proceed with deduction
      const { error } = await supabase
        .from("absences")
        .update({
          justified: true,
          type: "bank_deduction",
          reason: "Abatida no banco de horas",
          justification_date: new Date().toISOString(),
          deducted_from_bank: true,
        } as any)
        .eq("id", absence.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Falta abatida no banco de horas");
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["overtime"] });
      setBankAbsence(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedDate(undefined);
    setSelectedType("unjustified");
    setReason("");
  };

  const getStatusBadge = (absence: any) => {
    if (absence.type === "bank_deduction") {
      return <Badge variant="outline" className="text-xs text-primary border-primary"><Timer className="h-3 w-3 mr-1" />Banco horas</Badge>;
    }
    if (absence.type === "vacation_swap") {
      return <Badge variant="outline" className="text-xs text-primary border-primary"><ArrowRightLeft className="h-3 w-3 mr-1" />Troca férias</Badge>;
    }
    if (absence.justified) {
      return <Badge variant="outline" className="text-xs text-green-600 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />Justificada</Badge>;
    }
    if (absence.justification_deadline) {
      const daysLeft = differenceInCalendarDays(new Date(absence.justification_deadline), new Date());
      if (daysLeft < 0) {
        return <Badge variant="destructive" className="text-xs">Injustificada</Badge>;
      }
      return (
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {daysLeft + 1}d para justificar
        </Badge>
      );
    }
    return <Badge variant="destructive" className="text-xs">Injustificada</Badge>;
  };

  const canJustify = (absence: any) => {
    if (absence.justified) return false;
    if (!absence.justification_deadline) return false;
    return differenceInCalendarDays(new Date(absence.justification_deadline), new Date()) >= 0;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Registro de Faltas</h1>
            <p className="text-muted-foreground mt-1">Faltas automáticas e manuais com justificação</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Falta
            </Button>
          )}
        </div>

        {/* Summary cards */}
        {absences && absences.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total (dias)</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{absences.reduce((sum: number, a: any) => sum + (a.days_count ?? 1), 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Justificadas</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-green-600">{absences.filter((a: any) => a.justified).length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Injustificadas</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{absences.filter((a: any) => !a.justified && (!a.justification_deadline || differenceInCalendarDays(new Date(a.justification_deadline), new Date()) < 0)).length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-amber-600">{absences.filter((a: any) => canJustify(a)).length}</p></CardContent>
            </Card>
          </div>
        )}

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por funcionário..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="font-display">Faltas Registradas</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !absences?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((absence: any) => (
                    <TableRow key={absence.id}>
                      <TableCell className="font-medium">
                        {absence.employees?.first_name} {absence.employees?.last_name}
                      </TableCell>
                      <TableCell>{format(new Date(absence.absence_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={absence.days_count === 0.5 ? "outline" : "destructive"} className="text-xs">
                          {absence.days_count === 0.5 ? "½ dia" : "1 dia"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {absence.auto_detected ? "Automática" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(absence)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {absence.reason || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {absence.justification_deadline
                          ? format(new Date(absence.justification_deadline + "T12:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canJustify(absence) && (
                            <Button variant="ghost" size="icon" title="Justificar" onClick={() => { setJustifyOpen(absence.id); setReason(""); }}>
                              <FileText className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {isAdmin && !absence.justified && (
                            <Button variant="ghost" size="icon" title="Abater no banco de horas" onClick={() => setBankAbsence(absence)}>
                              <Timer className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {isAdmin && !absence.justified && (
                            <Button variant="ghost" size="icon" title="Trocar por dia de férias" onClick={() => setSwapAbsence(absence)}>
                              <ArrowRightLeft className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" title="Remover" onClick={() => setDeleteId(absence.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Register absence dialog (admin only) */}
      <Dialog open={registerOpen} onOpenChange={(o) => { if (!o) { setRegisterOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Falta Manualmente</DialogTitle>
            <DialogDescription>Apenas administradores podem registrar faltas manualmente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Funcionário</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Data da Falta</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unjustified">Injustificada</SelectItem>
                  <SelectItem value="justified">Justificada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." />
            </div>
            <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending || !selectedEmployee || !selectedDate} className="w-full">
              {registerMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Justify absence dialog */}
      <Dialog open={!!justifyOpen} onOpenChange={(o) => { if (!o) setJustifyOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar Falta</DialogTitle>
            <DialogDescription>Informe o motivo da falta para justificação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo da falta..." rows={4} />
            <Button onClick={() => justifyOpen && justifyMutation.mutate(justifyOpen)} disabled={justifyMutation.isPending || !reason.trim()} className="w-full">
              {justifyMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Justificar Falta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Falta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover esta falta? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Swap for vacation day confirmation */}
      <AlertDialog open={!!swapAbsence} onOpenChange={(o) => { if (!o) setSwapAbsence(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar Falta por Dia de Férias</AlertDialogTitle>
            <AlertDialogDescription>
              {swapAbsence && (
                <>
                  Tem certeza que deseja trocar a falta de{" "}
                  <strong>{swapAbsence.employees?.first_name} {swapAbsence.employees?.last_name}</strong>{" "}
                  no dia <strong>{format(new Date(swapAbsence.absence_date + "T12:00:00"), "dd/MM/yyyy")}</strong>{" "}
                  por 1 dia de férias? Isto irá subtrair 1 dia do saldo de férias do colaborador.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => swapAbsence && swapMutation.mutate(swapAbsence)}>
              {swapMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Confirmar Troca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Bank deduction confirmation */}
      <AlertDialog open={!!bankAbsence} onOpenChange={(o) => { if (!o) setBankAbsence(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abater Falta no Banco de Horas</AlertDialogTitle>
            <AlertDialogDescription>
              {bankAbsence && (
                <>
                  Tem certeza que deseja abater a falta de{" "}
                  <strong>{bankAbsence.employees?.first_name} {bankAbsence.employees?.last_name}</strong>{" "}
                  no dia <strong>{format(new Date(bankAbsence.absence_date + "T12:00:00"), "dd/MM/yyyy")}</strong>{" "}
                  no banco de horas? As horas previstas desse dia serão subtraídas do saldo de horas extra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => bankAbsence && bankDeductMutation.mutate(bankAbsence)}>
              {bankDeductMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
