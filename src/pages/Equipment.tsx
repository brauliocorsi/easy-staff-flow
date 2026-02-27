import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  HardHat, Wrench, Settings2, Plus, Trash2, Upload, RotateCcw,
  Loader2, Cog, ClipboardList, ListChecks, FileText, FileCheck2
} from "lucide-react";
import { generateEpiPdf } from "@/lib/generateEpiPdf";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";
import { EpiFormDialog } from "@/components/equipment/EpiFormDialog";
import { ToolFormDialog } from "@/components/equipment/ToolFormDialog";
import { MachineFormDialog } from "@/components/equipment/MachineFormDialog";
import { MaintenanceTaskFormDialog } from "@/components/equipment/MaintenanceTaskFormDialog";
import { MaintenanceLogDialog } from "@/components/equipment/MaintenanceLogDialog";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  delivered: { label: "Entregue", variant: "default" },
  returned: { label: "Devolvido", variant: "secondary" },
  expired: { label: "Expirado", variant: "destructive" },
  assigned: { label: "Atribuída", variant: "default" },
};

const conditionMap: Record<string, string> = {
  new: "Novo", good: "Bom", fair: "Razoável", damaged: "Danificado",
};

const freqMap: Record<string, string> = {
  daily: "Diária", weekly: "Semanal", monthly: "Mensal",
};

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcCompletionPercent(checklistData: any, machine?: any): number | null {
  const template = machine?.checklist_template || [];
  if (!Array.isArray(template) || template.length === 0) return null;
  const total = template.length;
  let done = 0;
  for (const field of template) {
    const val = checklistData?.[field.name];
    if (field.type === "checkbox") {
      if (val === true) done++;
    } else if (val !== undefined && val !== null && val !== "") {
      done++;
    }
  }
  return Math.round((done / total) * 100);
}

function completionBadge(pct: number | null) {
  if (pct === null) return <Badge variant="outline">N/A</Badge>;
  const variant = pct === 100 ? "default" : pct >= 50 ? "secondary" : "destructive";
  return <Badge variant={variant}>{pct}%</Badge>;
}

export default function Equipment() {
  const qc = useQueryClient();
  const { data: employees } = useEmployees("");
  const [epiDialog, setEpiDialog] = useState(false);
  const [toolDialog, setToolDialog] = useState(false);
  const [machineDialog, setMachineDialog] = useState(false);
  const [editMachine, setEditMachine] = useState<any>(null);
  const [taskDialog, setTaskDialog] = useState(false);
  const [logDialog, setLogDialog] = useState<{ task: any; machine: any } | null>(null);
  const [deleteId, setDeleteId] = useState<{ table: string; id: string } | null>(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [maintenanceTab, setMaintenanceTab] = useState("machines");
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ table: string; id: string } | null>(null);

  // Data queries
  const { data: epis, isLoading: loadingEpis } = useQuery({
    queryKey: ["epi-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("epi_deliveries" as any).select("*").order("delivery_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tools, isLoading: loadingTools } = useQuery({
    queryKey: ["tool-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tool_assignments" as any).select("*").order("assigned_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines" as any).select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["maintenance-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_tasks" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["maintenance-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_logs" as any).select("*").order("completed_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const [logDetailDialog, setLogDetailDialog] = useState<any>(null);

  const empName = (id: string) => {
    const e = employees?.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };

  const machineName = (id: string) => {
    const m = (machines || []).find((machine: any) => machine.id === id);
    return m ? (m as any).name : "—";
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from(deleteId.table as any).delete().eq("id", deleteId.id);
      if (error) throw error;
      toast.success("Eliminado com sucesso");
      qc.invalidateQueries({ queryKey: [deleteId.table === "epi_deliveries" ? "epi-deliveries" : deleteId.table === "tool_assignments" ? "tool-assignments" : deleteId.table] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleteId(null);
  };

  const handleReturn = async (id: string) => {
    try {
      const { error } = await supabase.from("tool_assignments" as any).update({
        status: "returned",
        returned_date: new Date().toISOString().slice(0, 10),
      }).eq("id", id);
      if (error) throw error;
      toast.success("Ferramenta marcada como devolvida");
      qc.invalidateQueries({ queryKey: ["tool-assignments"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    try {
      const path = `${uploadTarget.table}/${uploadTarget.id}/${file.name}`;
      const { error: upErr } = await supabase.storage.from("equipment").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("equipment").getPublicUrl(path);
      const { error } = await supabase.from(uploadTarget.table as any).update({ signed_file_url: urlData.publicUrl }).eq("id", uploadTarget.id);
      if (error) throw error;
      toast.success("Ficheiro carregado");
      qc.invalidateQueries({ queryKey: [uploadTarget.table === "epi_deliveries" ? "epi-deliveries" : "tool-assignments"] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploadTarget(null);
    e.target.value = "";
  };

  const handleDownloadEpiPdf = (epi: any) => {
    const emp = employees?.find((e) => e.id === epi.employee_id);
    if (!emp) return toast.error("Funcionário não encontrado");
    generateEpiPdf({
      employeeName: `${emp.first_name} ${emp.last_name}`,
      employeePosition: emp.position || "—",
      employeeDepartment: (emp as any).departments?.name || "—",
      itemName: epi.item_name,
      quantity: epi.quantity,
      deliveryDate: epi.delivery_date,
      expiryDate: epi.expiry_date,
      notes: epi.notes,
    });
  };

  const filteredEpis = filterEmp === "all" ? epis : (epis || []).filter((e: any) => e.employee_id === filterEmp);
  const filteredTools = filterEmp === "all" ? tools : (tools || []).filter((t: any) => t.employee_id === filterEmp);
  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Equipamentos</h1>
          <p className="text-muted-foreground">Gestão de EPIs, Ferramentas e Manutenções</p>
        </div>

        {/* Employee filter */}
        <div className="flex items-center gap-3">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por funcionário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funcionários</SelectItem>
              {activeEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="epis">
          <TabsList>
            <TabsTrigger value="epis" className="gap-1.5"><HardHat className="h-4 w-4" /> EPIs</TabsTrigger>
            <TabsTrigger value="tools" className="gap-1.5"><Wrench className="h-4 w-4" /> Ferramentas</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1.5"><Settings2 className="h-4 w-4" /> Manutenções</TabsTrigger>
          </TabsList>

          {/* EPIs Tab */}
          <TabsContent value="epis">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base">Entregas de EPIs</CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setEpiDialog(true)}>
                  <Plus className="h-4 w-4" /> Registar Entrega
                </Button>
              </CardHeader>
              <CardContent>
                {loadingEpis ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : !(filteredEpis || []).length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem entregas de EPIs registadas.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Data Entrega</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Assinado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filteredEpis || []).map((epi: any) => {
                        const s = statusMap[epi.status] || statusMap.delivered;
                        return (
                          <TableRow key={epi.id}>
                            <TableCell className="font-medium">{empName(epi.employee_id)}</TableCell>
                            <TableCell>{epi.item_name}</TableCell>
                            <TableCell>{epi.quantity}</TableCell>
                            <TableCell>{format(new Date(epi.delivery_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                            <TableCell>{epi.expiry_date ? format(new Date(epi.expiry_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                            <TableCell>
                              {epi.signed_file_url ? (
                                <a href={epi.signed_file_url} target="_blank" rel="noopener noreferrer">
                                  <Badge variant="default" className="gap-1 cursor-pointer"><FileCheck2 className="h-3 w-3" /> Sim</Badge>
                                </a>
                              ) : (
                                <Badge variant="outline">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimir PDF" onClick={() => handleDownloadEpiPdf(epi)}>
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Upload assinado"
                                  onClick={() => { setUploadTarget({ table: "epi_deliveries", id: epi.id }); document.getElementById("equip-file-input")?.click(); }}>
                                  <Upload className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId({ table: "epi_deliveries", id: epi.id })}>
                                  <Trash2 className="h-3.5 w-3.5" />
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
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base">Ferramentas Atribuídas</CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setToolDialog(true)}>
                  <Plus className="h-4 w-4" /> Atribuir Ferramenta
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTools ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : !(filteredTools || []).length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem ferramentas atribuídas.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Ferramenta</TableHead>
                        <TableHead>Nº Série</TableHead>
                        <TableHead>Data Atribuição</TableHead>
                        <TableHead>Condição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filteredTools || []).map((tool: any) => {
                        const s = statusMap[tool.status] || statusMap.assigned;
                        return (
                          <TableRow key={tool.id}>
                            <TableCell className="font-medium">{empName(tool.employee_id)}</TableCell>
                            <TableCell>{tool.tool_name}</TableCell>
                            <TableCell>{tool.serial_number || "—"}</TableCell>
                            <TableCell>{format(new Date(tool.assigned_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                            <TableCell>{conditionMap[tool.condition] || tool.condition}</TableCell>
                            <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {tool.status === "assigned" && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar devolvida" onClick={() => handleReturn(tool.id)}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Upload assinado"
                                  onClick={() => { setUploadTarget({ table: "tool_assignments", id: tool.id }); document.getElementById("equip-file-input")?.click(); }}>
                                  <Upload className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId({ table: "tool_assignments", id: tool.id })}>
                                  <Trash2 className="h-3.5 w-3.5" />
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
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <Tabs value={maintenanceTab} onValueChange={setMaintenanceTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="machines" className="gap-1.5"><Cog className="h-4 w-4" /> Máquinas</TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5"><ClipboardList className="h-4 w-4" /> Tarefas</TabsTrigger>
                <TabsTrigger value="logs" className="gap-1.5"><ListChecks className="h-4 w-4" /> Registos</TabsTrigger>
              </TabsList>

              {/* Machines */}
              <TabsContent value="machines">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-display text-base">Registo de Máquinas</CardTitle>
                    <Button size="sm" className="gap-1" onClick={() => { setEditMachine(null); setMachineDialog(true); }}>
                      <Plus className="h-4 w-4" /> Nova Máquina
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!(machines || []).length ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem máquinas registadas.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Localização</TableHead>
                            <TableHead>Campos Checklist</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(machines || []).map((m: any) => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium">{m.name}</TableCell>
                              <TableCell>{m.location || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{(m.checklist_template || []).length} campos</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => { setEditMachine(m); setMachineDialog(true); }}>Editar</Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId({ table: "machines", id: m.id })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tasks */}
              <TabsContent value="tasks">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-display text-base">Tarefas de Manutenção</CardTitle>
                    <Button size="sm" className="gap-1" onClick={() => setTaskDialog(true)}>
                      <Plus className="h-4 w-4" /> Nova Tarefa
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!(tasks || []).length ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem tarefas configuradas.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Máquina</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead>Frequência</TableHead>
                            <TableHead>Dia</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(tasks || []).map((t: any) => (
                            <TableRow key={t.id}>
                              <TableCell className="font-medium">{t.title}</TableCell>
                              <TableCell>{machineName(t.machine_id)}</TableCell>
                              <TableCell>{empName(t.employee_id)}</TableCell>
                              <TableCell>{freqMap[t.frequency] || t.frequency}</TableCell>
                              <TableCell>
                                {t.frequency === "weekly" && t.day_of_week != null ? DAYS_OF_WEEK[t.day_of_week] : ""}
                                {t.frequency === "monthly" && t.day_of_month ? `Dia ${t.day_of_month}` : ""}
                                {t.frequency === "daily" ? "Todos os dias" : ""}
                              </TableCell>
                              <TableCell>
                                <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Ativa" : "Inativa"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="outline" size="sm" onClick={() => {
                                    const machine = (machines || []).find((m: any) => m.id === t.machine_id);
                                    setLogDialog({ task: t, machine });
                                  }}>
                                    Registar
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId({ table: "maintenance_tasks", id: t.id })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Logs */}
              <TabsContent value="logs">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-base">Registos de Manutenção</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!(logs || []).length ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem registos de manutenção.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Máquina</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead>Conclusão</TableHead>
                            <TableHead>Observações</TableHead>
                            <TableHead className="text-right">Detalhes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(logs || []).map((l: any) => {
                            const machine = (machines || []).find((m: any) => m.id === l.machine_id);
                            const pct = calcCompletionPercent(l.checklist_data, machine);
                            return (
                              <TableRow key={l.id}>
                                <TableCell>{format(new Date(l.completed_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                                <TableCell>{machineName(l.machine_id)}</TableCell>
                                <TableCell>{empName(l.employee_id)}</TableCell>
                                <TableCell>{completionBadge(pct)}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{l.notes || "—"}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={() => setLogDetailDialog({ log: l, machine })}>
                                    Ver
                                  </Button>
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
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <EpiFormDialog open={epiDialog} onClose={() => setEpiDialog(false)} />
      <ToolFormDialog open={toolDialog} onClose={() => setToolDialog(false)} />
      {machineDialog && (
        <MachineFormDialog open={machineDialog} onClose={() => { setMachineDialog(false); setEditMachine(null); }} machine={editMachine} />
      )}
      <MaintenanceTaskFormDialog open={taskDialog} onClose={() => setTaskDialog(false)} />
      {logDialog && (
        <MaintenanceLogDialog open={!!logDialog} onClose={() => setLogDialog(null)} task={logDialog.task} machine={logDialog.machine} />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja eliminar este registo? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden file input */}
      <input id="equip-file-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />

      {/* Log Detail Dialog */}
      <Dialog open={!!logDetailDialog} onOpenChange={(v) => !v && setLogDetailDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes da Manutenção</DialogTitle>
            <DialogDescription>
              {logDetailDialog?.log && `${format(new Date(logDetailDialog.log.completed_date + "T00:00:00"), "dd/MM/yyyy")} — ${machineName(logDetailDialog.log.machine_id)}`}
            </DialogDescription>
          </DialogHeader>
          {logDetailDialog && (() => {
            const { log, machine } = logDetailDialog;
            const template = machine?.checklist_template || [];
            const pct = calcCompletionPercent(log.checklist_data, machine);
            return (
              <div className="space-y-4">
                {pct !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Conclusão</span>
                      {completionBadge(pct)}
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )}
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
                            <Badge variant={done ? "default" : "destructive"}>{done ? "✓ Sim" : "✗ Não"}</Badge>
                          ) : (
                            <span className="font-medium">{done ? String(val) : <Badge variant="destructive">Não preenchido</Badge>}</span>
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
                <div className="text-xs text-muted-foreground">
                  Responsável: {empName(log.employee_id)}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
