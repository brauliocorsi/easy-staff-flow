import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Palmtree, CheckCircle, Clock } from "lucide-react";
import { useEmployeeVacations } from "@/hooks/useVacations";
import { format } from "date-fns";
import { isVacationEnjoyed } from "@/lib/vacationStatus";

interface Props {
  employeeId: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  employee_suggested: { label: "Sugerido", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

export function EmployeeVacations({ employeeId }: Props) {
  const currentYear = new Date().getFullYear();
  const { data: vacations, isLoading } = useEmployeeVacations(employeeId, currentYear);

  if (isLoading) return <p className="text-xs text-muted-foreground">A carregar férias...</p>;

  const totalEntitled = Math.max(...(vacations || []).map(v => v.total_entitled_days), 22);
  const approvedDays = (vacations || [])
    .filter((v) => (v.status === "approved" || isVacationEnjoyed(v as any)) && !(v as any).sell_status)
    .reduce((sum, v) => sum + v.days_count, 0);
  const enjoyedDays = (vacations || [])
    .filter((v) => isVacationEnjoyed(v as any))
    .reduce((sum, v) => sum + v.days_count, 0);
  const soldDaysApproved = (vacations || [])
    .filter((v) => (v as any).sell_status === "sell_approved")
    .reduce((sum, v) => sum + ((v as any).sold_days || 0), 0);
  const remainingDays = totalEntitled - approvedDays - soldDaysApproved;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Direito:</span>
          <strong>{totalEntitled}d</strong>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Aprovados:</span>
          <strong>{approvedDays}d</strong>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Gozados:</span>
          <strong>{enjoyedDays}d</strong>
        </div>
        <Badge variant={remainingDays > 0 ? "default" : "secondary"}>
          {remainingDays > 0 ? `${remainingDays}d a gozar` : "Sem férias pendentes"}
        </Badge>
      </div>

      {vacations && vacations.length > 0 ? (
        <div className="space-y-2">
          {vacations.map((v) => {
            const st = statusLabels[v.status] || statusLabels.pending;
            const enjoyed = isVacationEnjoyed(v as any);
            return (
              <div key={v.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                <div className="flex items-center gap-2">
                  {enjoyed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>
                    {format(new Date(v.start_date + "T00:00:00"), "dd/MM")} - {format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}
                  </span>
                  <span className="text-muted-foreground">({v.days_count}d)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{v.category}</Badge>
                  <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                  {enjoyed && <Badge variant="default" className="text-xs bg-green-600">Gozada</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum pedido de férias registado para {currentYear}.</p>
      )}
    </div>
  );
}
