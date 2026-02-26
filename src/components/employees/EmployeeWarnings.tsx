import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const typeLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  verbal: { label: "Verbal", variant: "outline" },
  written: { label: "Escrita", variant: "secondary" },
  suspension: { label: "Suspensão", variant: "destructive" },
  termination: { label: "Demissão", variant: "destructive" },
};

export function EmployeeWarnings({ employeeId }: { employeeId: string }) {
  const { data: warnings, isLoading } = useQuery({
    queryKey: ["warnings", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warnings")
        .select("*")
        .eq("employee_id", employeeId)
        .order("warning_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;

  if (!warnings?.length) return <p className="text-xs text-muted-foreground">Nenhuma advertência registrada.</p>;

  return (
    <div className="space-y-2">
      {warnings.map((w) => {
        const t = typeLabels[w.type] || { label: w.type, variant: "outline" as const };
        return (
          <div key={w.id} className="flex items-start gap-3 border rounded-md p-2.5">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{w.reason}</span>
                <Badge variant={t.variant} className="text-xs">{t.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(w.warning_date), "dd/MM/yyyy")}
                {w.description ? ` — ${w.description}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
