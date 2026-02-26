import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  clock_in: { label: "Entrada", variant: "outline" },
  lunch_out: { label: "Em trabalho", variant: "default" },
  lunch_in: { label: "Almoço", variant: "secondary" },
  clock_out: { label: "Retornou", variant: "default" },
  complete: { label: "Completo", variant: "secondary" },
};

export function TodayStatus({ status, late }: { status: string; late?: boolean }) {
  const config = statusConfig[status] || statusConfig.clock_in;
  if (late) {
    return <Badge variant="destructive" className="text-xs">Atrasado · {config.label}</Badge>;
  }
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}
