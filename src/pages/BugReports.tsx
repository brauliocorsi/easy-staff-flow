import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, Bug } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";

const ADMIN_EMAIL = "brauliocorsi@upmoveis.pt";

export default function BugReports() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["bug-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && user.email === ADMIN_EMAIL,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase
        .from("bug_reports")
        .update({ resolved, status: resolved ? "resolved" : "open" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      toast.success("Atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bug_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      toast.success("Eliminado");
    },
  });

  if (loading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  const open = reports?.filter((r: any) => !r.resolved) || [];
  const resolved = reports?.filter((r: any) => r.resolved) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bug className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold">Relatórios de Bugs</h1>
            <p className="text-sm text-muted-foreground">
              Mensagens enviadas pelos utilizadores através do botão de ajuda.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">A carregar...</p>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-semibold">Pendentes ({open.length})</h2>
              {open.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem relatórios pendentes.</p>
              )}
              {open.map((r: any) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onResolve={() => resolveMutation.mutate({ id: r.id, resolved: true })}
                  onDelete={() => deleteMutation.mutate(r.id)}
                />
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">Resolvidos ({resolved.length})</h2>
              {resolved.map((r: any) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onResolve={() => resolveMutation.mutate({ id: r.id, resolved: false })}
                  onDelete={() => deleteMutation.mutate(r.id)}
                  isResolved
                />
              ))}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function ReportCard({
  report,
  onResolve,
  onDelete,
  isResolved,
}: {
  report: any;
  onResolve: () => void;
  onDelete: () => void;
  isResolved?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{report.user_email || "Utilizador"}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
              {report.page_url && <> · <code className="text-xs">{report.page_url}</code></>}
            </p>
          </div>
          <Badge variant={isResolved ? "secondary" : "destructive"}>
            {isResolved ? "Resolvido" : "Aberto"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{report.message}</p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={onResolve}>
            <Check className="h-4 w-4" />
            {isResolved ? "Reabrir" : "Marcar resolvido"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
