import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ClipboardCheck, Plus } from "lucide-react";
import EvaluationCard from "@/components/evaluations/EvaluationCard";
import EvaluationFormDialog from "@/components/evaluations/EvaluationFormDialog";
import EvaluationDetailDialog from "@/components/evaluations/EvaluationDetailDialog";

export default function Evaluations() {
  const [tab, setTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailEval, setDetailEval] = useState<any>(null);

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ["evaluations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_evaluations")
        .select("*, employee:employee_id(id, first_name, last_name, avatar_url, position), evaluator:evaluator_id(id, first_name, last_name, avatar_url, position)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = evaluations?.filter((e: any) => {
    if (tab === "pending") return e.status === "pending" || e.status === "in_progress";
    if (tab === "completed") return e.status === "completed";
    return true;
  }) || [];

  const pendingCount = evaluations?.filter((e: any) => e.status === "pending" || e.status === "in_progress").length || 0;
  const completedCount = evaluations?.filter((e: any) => e.status === "completed").length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6" />
              Avaliações de Funcionários
            </h1>
            <p className="text-muted-foreground mt-1">Solicite e acompanhe avaliações atribuídas a líderes.</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Avaliação
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todas ({evaluations?.length || 0})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingCount})</TabsTrigger>
            <TabsTrigger value="completed">Concluídas ({completedCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhuma avaliação encontrada.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filtered.map((ev: any) => (
                  <EvaluationCard key={ev.id} evaluation={ev} onClick={() => setDetailEval(ev)} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EvaluationFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <EvaluationDetailDialog open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
    </AppLayout>
  );
}
