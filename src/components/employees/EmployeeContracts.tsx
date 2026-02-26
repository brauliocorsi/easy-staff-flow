import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

const typeLabels: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  temporary: "Temporário",
  internship: "Estágio",
  other: "Outro",
};

export function EmployeeContracts({ employeeId }: { employeeId: string }) {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;

  if (!contracts?.length) return <p className="text-xs text-muted-foreground">Nenhum contrato registrado.</p>;

  return (
    <div className="space-y-2">
      {contracts.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border rounded-md p-2.5">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{typeLabels[c.type] || c.type}</span>
              <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                {c.is_active ? "Ativo" : "Encerrado"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(c.start_date), "dd/MM/yyyy")}
              {c.end_date ? ` — ${format(new Date(c.end_date), "dd/MM/yyyy")}` : " — Sem data fim"}
              {c.salary ? ` · €${Number(c.salary).toFixed(2)}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
