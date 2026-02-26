import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EvaluationFormDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"individual" | "group">("individual");
  const [employeeId, setEmployeeId] = useState("");
  const [evaluatorId, setEvaluatorId] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["employees-for-eval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, manager_id")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Leaders = employees who have at least one direct report
  const leaders = useMemo(() => {
    if (!employees) return [];
    const managerIds = new Set(employees.filter((e) => e.manager_id).map((e) => e.manager_id));
    return employees.filter((e) => managerIds.has(e.id));
  }, [employees]);

  // Direct reports of the selected leader
  const directReports = useMemo(() => {
    if (!leaderId || !employees) return [];
    return employees.filter((e) => e.manager_id === leaderId);
  }, [leaderId, employees]);

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === directReports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(directReports.map((e) => e.id));
    }
  };

  const handleReset = () => {
    setEmployeeId("");
    setEvaluatorId("");
    setLeaderId("");
    setSelectedIds([]);
  };

  const handleSubmitIndividual = async () => {
    if (!employeeId || !evaluatorId) {
      toast.error("Selecione o funcionário e o avaliador");
      return;
    }
    if (employeeId === evaluatorId) {
      toast.error("O avaliador não pode ser o próprio funcionário");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("employee_evaluations").insert({
        employee_id: employeeId,
        evaluator_id: evaluatorId,
        requested_by: user!.id,
        status: "pending",
      } as any);
      if (error) throw error;
      toast.success("Avaliação solicitada com sucesso");
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      handleReset();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar avaliação");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitGroup = async () => {
    if (!leaderId) {
      toast.error("Selecione o líder avaliador");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um funcionário");
      return;
    }
    setLoading(true);
    try {
      const inserts = selectedIds.map((empId) => ({
        employee_id: empId,
        evaluator_id: leaderId,
        requested_by: user!.id,
        status: "pending",
      }));
      const { error } = await supabase.from("employee_evaluations").insert(inserts as any);
      if (error) throw error;
      toast.success(`${selectedIds.length} avaliações solicitadas com sucesso`);
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      handleReset();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar avaliações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleReset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Avaliação</DialogTitle>
          <DialogDescription>Atribua avaliações individuais ou em grupo.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as any); handleReset(); }}>
          <TabsList className="w-full">
            <TabsTrigger value="individual" className="flex-1 gap-1.5">
              <User className="h-3.5 w-3.5" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1 gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Grupo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Funcionário a avaliar</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} — {e.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Líder avaliador</Label>
              <Select value={evaluatorId} onValueChange={setEvaluatorId}>
                <SelectTrigger><SelectValue placeholder="Selecionar avaliador" /></SelectTrigger>
                <SelectContent>
                  {employees?.filter((e) => e.id !== employeeId).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} — {e.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Líder avaliador</Label>
              <Select value={leaderId} onValueChange={(v) => { setLeaderId(v); setSelectedIds([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar líder" /></SelectTrigger>
                <SelectContent>
                  {leaders.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} — {e.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {leaderId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Liderados ({directReports.length})</Label>
                  {directReports.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                      {selectedIds.length === directReports.length ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  )}
                </div>
                {directReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este líder não tem liderados atribuídos.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                    {directReports.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedIds.includes(e.id)}
                          onCheckedChange={() => toggleEmployee(e.id)}
                        />
                        <span className="text-sm">{e.first_name} {e.last_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{e.position}</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedIds.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedIds.length} selecionado{selectedIds.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => { handleReset(); onClose(); }}>Cancelar</Button>
          <Button
            onClick={mode === "individual" ? handleSubmitIndividual : handleSubmitGroup}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === "group" && selectedIds.length > 1
              ? `Solicitar ${selectedIds.length} Avaliações`
              : "Solicitar Avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
