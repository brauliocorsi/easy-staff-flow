import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, Wrench, FileText, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";

interface Props {
  open: boolean;
  onClose: () => void;
  machine: any;
}

const repairStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "destructive" },
  in_progress: { label: "Em Curso", variant: "secondary" },
  completed: { label: "Concluído", variant: "default" },
};

function calcCompletion(checklistData: any, template: any[]): number | null {
  if (!Array.isArray(template) || template.length === 0) return null;
  let done = 0;
  for (const field of template) {
    const val = checklistData?.[field.name];
    if (field.type === "checkbox") { if (val === true) done++; }
    else if (val !== undefined && val !== null && val !== "") done++;
  }
  return Math.round((done / template.length) * 100);
}

export function MachineHealthDialog({ open, onClose, machine }: Props) {
  const qc = useQueryClient();
  const { data: employees } = useEmployees("");

  const { data: logs } = useQuery({
    queryKey: ["machine-health-logs", machine?.id],
    queryFn: async () => {
      if (!machine?.id) return [];
      const { data, error } = await supabase
        .from("maintenance_logs" as any)
        .select("*")
        .eq("machine_id", machine.id)
        .order("completed_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!machine?.id,
  });

  const { data: repairs } = useQuery({
    queryKey: ["machine-health-repairs", machine?.id],
    queryFn: async () => {
      if (!machine?.id) return [];
      const { data, error } = await supabase
        .from("machine_repairs" as any)
        .select("*")
        .eq("machine_id", machine.id)
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!machine?.id,
  });

  const empName = (id: string) => {
    const e = employees?.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };

  const handleDeleteRepair = async (id: string) => {
    try {
      const { error } = await supabase.from("machine_repairs" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Reparação eliminada");
      qc.invalidateQueries({ queryKey: ["machine-health-repairs", machine?.id] });
      qc.invalidateQueries({ queryKey: ["machine-repairs"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const template = machine?.checklist_template || [];
  const pendingRepairs = (repairs || []).filter((r: any) => r.status !== "completed").length;
  const totalRepairs = (repairs || []).length;
  const totalLogs = (logs || []).length;

  // Compute avg completion from last 5 logs
  const recentLogs = (logs || []).slice(0, 5);
  const avgCompletion = recentLogs.length > 0
    ? Math.round(recentLogs.reduce((sum: number, l: any) => {
        const pct = calcCompletion(l.checklist_data, template);
        return sum + (pct ?? 100);
      }, 0) / recentLogs.length)
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Saúde da Máquina — {machine?.name}
          </DialogTitle>
          <DialogDescription>
            {machine?.location && `📍 ${machine.location}`}
            {machine?.description && ` · ${machine.description}`}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{totalLogs}</p>
            <p className="text-xs text-muted-foreground">Manutenções Preventivas</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${pendingRepairs > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <p className="text-xl font-bold">{pendingRepairs}/{totalRepairs}</p>
            <p className="text-xs text-muted-foreground">Reparações Pendentes</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{avgCompletion !== null ? `${avgCompletion}%` : "N/A"}</p>
            <p className="text-xs text-muted-foreground">Média Conclusão (últ. 5)</p>
          </div>
        </div>

        {avgCompletion !== null && (
          <Progress value={avgCompletion} className="h-2" />
        )}

        <Separator />

        <Tabs defaultValue="repairs">
          <TabsList className="w-full">
            <TabsTrigger value="repairs" className="flex-1 gap-1"><Wrench className="h-3.5 w-3.5" /> Reparações ({totalRepairs})</TabsTrigger>
            <TabsTrigger value="preventive" className="flex-1 gap-1"><CheckCircle className="h-3.5 w-3.5" /> Preventivas ({totalLogs})</TabsTrigger>
          </TabsList>

          <TabsContent value="repairs" className="mt-3">
            {!(repairs || []).length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem reparações registadas.</p>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {(repairs || []).map((r: any) => {
                  const st = repairStatusMap[r.status] || repairStatusMap.pending;
                  return (
                    <div key={r.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{r.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.repair_date + "T00:00:00"), "dd/MM/yyyy")}
                            {r.company_name && ` · ${r.company_name}`}
                            {r.technician_name && ` · ${r.technician_name}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteRepair(r.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {r.parts_replaced && <span>🔧 Peças: {r.parts_replaced}</span>}
                        {r.cost && <span>💰 {Number(r.cost).toFixed(2)}€</span>}
                        {r.reported_by && <span>👤 {empName(r.reported_by)}</span>}
                        {r.resolved_date && <span>✅ Resolvido: {format(new Date(r.resolved_date + "T00:00:00"), "dd/MM/yyyy")}</span>}
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
                      {r.invoice_url && (
                        <a href={r.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="h-3 w-3" /> Ver Fatura <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preventive" className="mt-3">
            {!(logs || []).length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem manutenções preventivas registadas.</p>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {(logs || []).map((l: any) => {
                  const pct = calcCompletion(l.checklist_data, template);
                  return (
                    <div key={l.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{format(new Date(l.completed_date + "T00:00:00"), "dd/MM/yyyy")}</p>
                          <p className="text-xs text-muted-foreground">👤 {empName(l.employee_id)}</p>
                        </div>
                        {pct !== null && (
                          <Badge variant={pct === 100 ? "default" : pct >= 50 ? "secondary" : "destructive"} className="text-xs">
                            {pct}%
                          </Badge>
                        )}
                      </div>
                      {Array.isArray(template) && template.length > 0 && (
                        <div className="grid grid-cols-2 gap-1">
                          {template.map((field: any, idx: number) => {
                            const val = l.checklist_data?.[field.name];
                            const isCheck = field.type === "checkbox";
                            const done = isCheck ? val === true : val !== undefined && val !== null && val !== "";
                            return (
                              <div key={idx} className="flex items-center gap-1.5 text-xs">
                                <span className={done ? "text-primary" : "text-destructive"}>{done ? "✓" : "✗"}</span>
                                <span className="text-muted-foreground">{field.label || field.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {l.notes && <p className="text-xs text-muted-foreground italic">{l.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
