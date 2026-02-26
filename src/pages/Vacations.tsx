import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Palmtree, Factory, Warehouse, CheckCircle, Clock, Link2, ToggleRight, ChevronDown, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVacationRequests, useUpdateVacationRequest, useGetVacationPublicLink, useDeleteVacationRequest, VacationRequest } from "@/hooks/useVacations";
import { VacationFormDialog } from "@/components/vacations/VacationFormDialog";
import { CollectiveVacationForm } from "@/components/vacations/CollectiveVacationForm";
import { VacationMap } from "@/components/vacations/VacationMap";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  employee_suggested: { label: "Sugerido pelo Func.", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

interface EmployeeGroup {
  employeeId: string;
  employeeName: string;
  totalEntitled: number;
  requests: VacationRequest[];
  totalDays: number;
  approvedDays: number;
  enjoyedDays: number;
}

function groupByEmployee(vacations: VacationRequest[]): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>();
  for (const v of vacations) {
    if (!map.has(v.employee_id)) {
      const name = v.employees ? `${v.employees.first_name} ${v.employees.last_name}` : "—";
      map.set(v.employee_id, {
        employeeId: v.employee_id,
        employeeName: name,
        totalEntitled: v.total_entitled_days,
        requests: [],
        totalDays: 0,
        approvedDays: 0,
        enjoyedDays: 0,
      });
    }
    const g = map.get(v.employee_id)!;
    g.requests.push(v);
    g.totalDays += v.days_count;
    if (v.status === "approved" || v.enjoyed) g.approvedDays += v.days_count;
    if (v.enjoyed) g.enjoyedDays += v.days_count;
  }
  return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export default function Vacations() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: vacations, isLoading } = useVacationRequests(year);
  const updateMutation = useUpdateVacationRequest();
  const deleteMutation = useDeleteVacationRequest();
  const getLinkMutation = useGetVacationPublicLink();

  const individualVacations = (vacations || []).filter((v) => v.category === "individual");
  const employeeGroups = groupByEmployee(individualVacations);

  const handleApprove = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, status: "approved", admin_confirmed: true });
      toast.success("Férias aprovadas");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApproveAll = async (requests: VacationRequest[]) => {
    try {
      for (const r of requests) {
        if (r.status !== "approved") {
          await updateMutation.mutateAsync({ id: r.id, status: "approved", admin_confirmed: true });
        }
      }
      toast.success("Todos os períodos aprovados");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggleEnjoyed = async (id: string, current: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, enjoyed: !current });
      toast.success(!current ? "Marcado como gozada" : "Desmarcado");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Período eliminado");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCopyLink = async (id: string) => {
    try {
      const data = await getLinkMutation.mutateAsync(id);
      if (data?.public_link) {
        await navigator.clipboard.writeText(data.public_link);
        toast.success("Link copiado!", { description: "Partilhe com o colaborador." });
      }
    } catch { toast.error("Falha ao obter link"); }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const totalPending = (vacations || []).filter((v) => !v.enjoyed && v.status !== "rejected").length;
  const totalApproved = (vacations || []).filter((v) => v.status === "approved").length;
  const totalEnjoyed = (vacations || []).filter((v) => v.enjoyed).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Mapa de Férias</h1>
            <p className="text-muted-foreground mt-1">Gerencie férias individuais e coletivas</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo Pedido
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{totalPending}</p>
                  <p className="text-sm text-muted-foreground">Pedidos pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{totalApproved}</p>
                  <p className="text-sm text-muted-foreground">Aprovadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Palmtree className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalEnjoyed}</p>
                  <p className="text-sm text-muted-foreground">Gozadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map" className="gap-1"><CalendarDays className="h-4 w-4" /> Mapa Anual</TabsTrigger>
            <TabsTrigger value="individual" className="gap-1"><Palmtree className="h-4 w-4" /> Individual</TabsTrigger>
            <TabsTrigger value="factory" className="gap-1"><Factory className="h-4 w-4" /> Fábrica</TabsTrigger>
            <TabsTrigger value="warehouse" className="gap-1"><Warehouse className="h-4 w-4" /> Armazém</TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <VacationMap vacations={vacations || []} year={year} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="individual">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Férias Individuais — {year}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">A carregar...</p>
                ) : !employeeGroups.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido de férias individual para {year}.</p>
                ) : (
                  <div className="space-y-2">
                    {employeeGroups.map((group) => (
                      <Collapsible key={group.employeeId}>
                        <div className="border rounded-lg">
                          <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [&[data-state=open]]:rotate-180" />
                              <span className="font-medium">{group.employeeName}</span>
                              <Badge variant="outline" className="text-xs">
                                {group.requests.length} período{group.requests.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">
                                {group.totalDays}/{group.totalEntitled}d
                              </span>
                              <Badge variant={group.approvedDays > 0 ? "default" : "outline"} className="text-xs">
                                {group.approvedDays}d aprovados
                              </Badge>
                              <Badge variant={group.enjoyedDays > 0 ? "default" : "outline"} className="text-xs bg-green-600">
                                {group.enjoyedDays}d gozados
                              </Badge>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleApproveAll(group.requests)}>
                                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Aprovar todos</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyLink(group.requests[0].id)}>
                                      <Link2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copiar link público</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t px-4 pb-3 pt-2 space-y-2">
                              {group.requests.map((v) => {
                                const st = statusLabels[v.status] || statusLabels.pending;
                                return (
                                  <div key={v.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-md p-2">
                                    <div className="flex items-center gap-2">
                                      {v.enjoyed ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>
                                        {v.days_count === 0
                                          ? "Sem datas — aguarda colaborador"
                                          : `${format(new Date(v.start_date + "T00:00:00"), "dd/MM")} - ${format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}`}
                                      </span>
                                      {v.days_count > 0 && (
                                        <span className="text-muted-foreground">({v.days_count}d)</span>
                                      )}
                                      {v.category !== "individual" && (
                                        <Badge variant="secondary" className="text-xs">Coletiva</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                                      {v.employee_confirmed && <Badge variant="outline" className="text-xs">Func. OK</Badge>}
                                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleToggleEnjoyed(v.id, v.enjoyed)}>
                                        <ToggleRight className={`h-3.5 w-3.5 mr-1 ${v.enjoyed ? "text-green-600" : "text-muted-foreground"}`} />
                                        <span className="text-xs">{v.enjoyed ? "Gozada" : "Não gozada"}</span>
                                      </Button>
                                      {v.status !== "approved" && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleApprove(v.id)}>
                                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Aprovar</TooltipContent>
                                        </Tooltip>
                                      )}
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Eliminar período?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(v.id)}>Eliminar</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factory">
            <CollectiveVacationForm year={year} category="factory" title="Férias de Fábrica" />
          </TabsContent>
          <TabsContent value="warehouse">
            <CollectiveVacationForm year={year} category="warehouse" title="Férias de Armazém" />
          </TabsContent>
        </Tabs>
      </div>

      <VacationFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} year={year} />
    </AppLayout>
  );
}
