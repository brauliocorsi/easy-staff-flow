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
      // Create a 1-day approved vacation request
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

      // Justify the absence
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

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedDate(undefined);
    setSelectedType("unjustified");
    setReason("");
  };

  const getStatusBadge = (absence: any) => {
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
    </AppLayout>
  );
}
