import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Palmtree, Factory, Warehouse, CheckCircle, Clock, Send, Eye, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVacationRequests, useUpdateVacationRequest, useSendVacationEmail } from "@/hooks/useVacations";
import { VacationFormDialog } from "@/components/vacations/VacationFormDialog";
import { CollectiveVacationForm } from "@/components/vacations/CollectiveVacationForm";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  employee_suggested: { label: "Sugerido pelo Func.", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

const categoryLabels: Record<string, string> = {
  individual: "Individual",
  factory: "Fábrica",
  warehouse: "Armazém",
};

export default function Vacations() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: vacations, isLoading } = useVacationRequests(year);
  const updateMutation = useUpdateVacationRequest();
  const sendEmailMutation = useSendVacationEmail();

  const individualVacations = (vacations || []).filter((v) => v.category === "individual");

  const handleApprove = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, status: "approved", admin_confirmed: true });
      toast.success("Férias aprovadas");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleEnjoyed = async (id: string, current: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, enjoyed: !current });
      toast.success(!current ? "Marcado como gozada" : "Desmarcado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResendEmail = async (id: string) => {
    try {
      await sendEmailMutation.mutateAsync(id);
      toast.success("E-mail reenviado");
    } catch {
      toast.error("Falha ao enviar e-mail");
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Summary cards
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
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </div>
        </div>

        {/* Summary cards */}
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

        <Tabs defaultValue="individual">
          <TabsList>
            <TabsTrigger value="individual" className="gap-1">
              <Palmtree className="h-4 w-4" /> Individual
            </TabsTrigger>
            <TabsTrigger value="factory" className="gap-1">
              <Factory className="h-4 w-4" /> Fábrica
            </TabsTrigger>
            <TabsTrigger value="warehouse" className="gap-1">
              <Warehouse className="h-4 w-4" /> Armazém
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Férias Individuais — {year}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">A carregar...</p>
                ) : !individualVacations.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido de férias individual para {year}.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Func. Confirmou</TableHead>
                        <TableHead>Gozada</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {individualVacations.map((v) => {
                        const st = statusLabels[v.status] || statusLabels.pending;
                        const empName = v.employees
                          ? `${v.employees.first_name} ${v.employees.last_name}`
                          : "—";
                        return (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{empName}</TableCell>
                            <TableCell>
                              {v.start_date && v.end_date
                                ? `${format(new Date(v.start_date + "T00:00:00"), "dd/MM")} - ${format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}`
                                : "A definir"}
                            </TableCell>
                            <TableCell>{v.days_count || "—"}</TableCell>
                            <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                            <TableCell>
                              {v.employee_confirmed ? (
                                <Badge variant="default" className="text-xs">Sim</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleEnjoyed(v.id, v.enjoyed)}
                                className={v.enjoyed ? "text-green-600" : "text-muted-foreground"}
                              >
                                <ToggleRight className="h-4 w-4 mr-1" />
                                {v.enjoyed ? "Sim" : "Não"}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {v.status !== "approved" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" onClick={() => handleApprove(v.id)}>
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Aprovar</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => handleResendEmail(v.id)}>
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reenviar e-mail</TooltipContent>
                                </Tooltip>
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
