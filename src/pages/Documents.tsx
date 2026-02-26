import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Loader2, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { DocumentFormDialog } from "@/components/documents/DocumentFormDialog";
import { toast } from "sonner";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  contract: "Contrato",
  id: "Identidade",
  certificate: "Certificado",
  medical: "Atestado",
  training: "Formação",
  other: "Outro",
};

export default function Documents() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: employees } = useEmployees("");
  const qc = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const empName = (id: string) => {
    const e = employees?.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este documento?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Documento removido");
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground mt-1">Gerencie documentos dos funcionários</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Documento
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="font-display">Todos os Documentos</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !documents?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum documento cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{empName(doc.employee_id)}</Badge>
                          <Badge variant="outline" className="text-xs">{TYPE_LABELS[doc.type] || doc.type}</Badge>
                          {doc.expiry_date && (
                            <Badge variant="outline" className="text-xs">Validade: {format(new Date(doc.expiry_date + "T00:00:00"), "dd/MM/yyyy")}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {doc.file_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">Ver</a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppLayout>
  );
}