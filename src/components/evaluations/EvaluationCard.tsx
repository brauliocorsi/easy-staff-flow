import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface EvaluationCardProps {
  evaluation: any;
  onClick?: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  in_progress: { label: "Em Progresso", variant: "secondary", icon: Clock },
  completed: { label: "Concluída", variant: "default", icon: CheckCircle2 },
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function EvaluationCard({ evaluation, onClick }: EvaluationCardProps) {
  const cfg = statusConfig[evaluation.status] || statusConfig.pending;
  const Icon = cfg.icon;
  const emp = evaluation.employee;
  const evaluator = evaluation.evaluator;
  const empInitials = emp ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase() : "??";

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${evaluation.status === "completed" ? "border-green-200 dark:border-green-900" : evaluation.status === "pending" ? "border-amber-200 dark:border-amber-900" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={emp?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{empInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Avaliador: {evaluator ? `${evaluator.first_name} ${evaluator.last_name}` : "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={cfg.variant} className="text-xs gap-1">
              <Icon className="h-3 w-3" />
              {cfg.label}
            </Badge>
            {evaluation.status === "completed" && evaluation.rating && (
              <StarRating value={evaluation.rating} />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {format(new Date(evaluation.created_at), "dd/MM/yyyy")}
          {evaluation.completed_at && ` · Concluída ${format(new Date(evaluation.completed_at), "dd/MM/yyyy")}`}
        </p>
      </CardContent>
    </Card>
  );
}

export { StarRating };
