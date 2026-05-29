import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  clock_in: { label: "Ainda não entrou", variant: "outline" },
  lunch_out: { label: "Entrada registada", variant: "default" },
  lunch_in: { label: "Em pausa de almoço", variant: "secondary" },
  clock_out: { label: "Após almoço", variant: "default" },
  complete: { label: "Dia completo", variant: "secondary" },
};

export function TodayStatus({ status, late }: { status: string; late?: boolean }) {
  const config = statusConfig[status] || statusConfig.clock_in;
  if (late) {
    return <Badge variant="destructive" className="text-xs">Atrasado · {config.label}</Badge>;
  }
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}
