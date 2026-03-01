import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Pencil, Trash2, Loader2, AlertTriangle, CheckCircle, Palmtree, Eye } from "lucide-react";
import { useEmployees, useDeleteEmployee, type Employee } from "@/hooks/useEmployees";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  on_leave: { label: "Afastado", variant: "outline" },
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const { data: employees, isLoading, error } = useEmployees(search);
  const deleteMutation = useDeleteEmployee();
  const navigate = useNavigate();

  // Fetch absence counts per employee
  const { data: absenceCounts } = useQuery({
    queryKey: ["absence-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, justified");
      if (error) throw error;
      const counts: Record<string, { justified: number; unjustified: number }> = {};
      for (const a of data || []) {
        if (!counts[a.employee_id]) counts[a.employee_id] = { justified: 0, unjustified: 0 };
        if (a.justified) counts[a.employee_id].justified++;
        else counts[a.employee_id].unjustified++;
      }
      return counts;
    },
  });

  // Fetch warning counts per employee
  const { data: warningCounts } = useQuery({
    queryKey: ["warning-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warnings")
        .select("employee_id, type");
      if (error) throw error;
      const counts: Record<string, { total: number; verbal: number; written: number; suspension: number; termination: number }> = {};
      for (const w of data || []) {
        if (!counts[w.employee_id]) counts[w.employee_id] = { total: 0, verbal: 0, written: 0, suspension: 0, termination: 0 };
        counts[w.employee_id].total++;
        const t = w.type as keyof typeof counts[string];
        if (t in counts[w.employee_id]) (counts[w.employee_id] as any)[t]++;
      }
      return counts;
    },
  });

  // Fetch vacation status per employee (current year)
  const currentYear = new Date().getFullYear();
  const { data: vacationData } = useQuery({
    queryKey: ["vacation-summary", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("employee_id, days_count, status, enjoyed, total_entitled_days")
        .eq("year", currentYear);
      if (error) throw error;
      const summary: Record<string, { entitled: number; approved: number; enjoyed: number; pending: boolean }> = {};
      for (const v of data || []) {
        if (!summary[v.employee_id]) summary[v.employee_id] = { entitled: (v as any).total_entitled_days || 22, approved: 0, enjoyed: 0, pending: false };
        if (v.status === "approved" || (v as any).enjoyed) summary[v.employee_id].approved += v.days_count;
        if ((v as any).enjoyed) summary[v.employee_id].enjoyed += v.days_count;
        if (v.status === "pending" || v.status === "employee_suggested") summary[v.employee_id].pending = true;
      }
      return summary;
    },
  });

  const handleEdit = (emp: Employee) => {
    setEditing(emp);
    setDialogOpen(true);
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Remover ${emp.first_name} ${emp.last_name}?`)) return;
    try {
      await deleteMutation.mutateAsync(emp.id);
      toast.success("Funcionário removido");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Funcionários</h1>
            <p className="text-muted-foreground mt-1">Gerencie os funcionários da empresa</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Funcionário
          </Button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar funcionário..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Lista de Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">Erro ao carregar funcionários. Verifique se você está logado.</p>
            ) : !employees?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                     <TableHead>Cargo</TableHead>
                     <TableHead>Departamento</TableHead>
                     <TableHead>Email</TableHead>
                     <TableHead>Faltas</TableHead>
                     <TableHead>Advertências</TableHead>
                     <TableHead>Férias</TableHead>
                     <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const initials = `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase();
                    const st = statusMap[emp.status] || statusMap.active;
                    return (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={emp.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{emp.position}</TableCell>
                        <TableCell className="text-muted-foreground">{(emp as any).departments?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            {absenceCounts?.[emp.id] ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="destructive" className="text-xs gap-0.5">
                                      <AlertTriangle className="h-3 w-3" />
                                      {absenceCounts[emp.id].unjustified}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Faltas injustificadas</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs gap-0.5 text-green-600 border-green-500">
                                      <CheckCircle className="h-3 w-3" />
                                      {absenceCounts[emp.id].justified}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Faltas justificadas</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {warningCounts?.[emp.id] ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive" className="text-xs gap-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  {warningCounts[emp.id].total}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {warningCounts[emp.id].verbal > 0 && <div>Verbal: {warningCounts[emp.id].verbal}</div>}
                                {warningCounts[emp.id].written > 0 && <div>Escrita: {warningCounts[emp.id].written}</div>}
                                {warningCounts[emp.id].suspension > 0 && <div>Suspensão: {warningCounts[emp.id].suspension}</div>}
                                {warningCounts[emp.id].termination > 0 && <div>Justa Causa: {warningCounts[emp.id].termination}</div>}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {vacationData?.[emp.id] ? (
                            <Tooltip>
                              <TooltipTrigger>
                                {vacationData[emp.id].approved - vacationData[emp.id].enjoyed > 0 ? (
                                  <Badge variant="default" className="text-xs gap-0.5">
                                    <Palmtree className="h-3 w-3" />
                                    {vacationData[emp.id].approved - vacationData[emp.id].enjoyed}d a gozar
                                  </Badge>
                                ) : vacationData[emp.id].pending ? (
                                  <Badge variant="outline" className="text-xs gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    Pendente
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">OK</Badge>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <div>Direito: {vacationData[emp.id].entitled}d</div>
                                <div>Aprovados: {vacationData[emp.id].approved}d</div>
                                <div>Gozados: {vacationData[emp.id].enjoyed}d</div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => navigate(`/funcionarios/${emp.id}`)}>
                                  <Eye className="h-4 w-4 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver Saúde</TooltipContent>
                            </Tooltip>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(emp)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeFormDialog
        key={editing?.id || "new"}
        open={dialogOpen}
        onClose={handleClose}
        employee={editing}
      />
    </AppLayout>
  );
}
