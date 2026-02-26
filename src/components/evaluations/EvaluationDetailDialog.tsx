import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  evaluation: any;
}

function RatingRow({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        ))}
      </div>
    </div>
  );
}

export default function EvaluationDetailDialog({ open, onClose, evaluation }: Props) {
  if (!evaluation) return null;
  const emp = evaluation.employee;
  const evaluator = evaluation.evaluator;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Detalhes da Avaliação</DialogTitle>
          <DialogDescription>
            {emp && `${emp.first_name} ${emp.last_name}`} — avaliado por {evaluator && `${evaluator.first_name} ${evaluator.last_name}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Data de criação</span>
            <span>{format(new Date(evaluation.created_at), "dd/MM/yyyy")}</span>
          </div>
          {evaluation.completed_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data de conclusão</span>
              <span>{format(new Date(evaluation.completed_at), "dd/MM/yyyy")}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={evaluation.status === "completed" ? "default" : "outline"}>
              {evaluation.status === "completed" ? "Concluída" : evaluation.status === "in_progress" ? "Em Progresso" : "Pendente"}
            </Badge>
          </div>

          {evaluation.status === "completed" && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Classificações</h4>
                <RatingRow label="Nota Geral" value={evaluation.rating} />
                <RatingRow label="Desempenho" value={evaluation.performance_rating} />
                <RatingRow label="Trabalho em Equipa" value={evaluation.teamwork_rating} />
                <RatingRow label="Pontualidade" value={evaluation.punctuality_rating} />
                <RatingRow label="Comunicação" value={evaluation.communication_rating} />
              </div>
              <Separator />
              <div className="space-y-3">
                {evaluation.strengths && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Pontos Fortes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{evaluation.strengths}</p>
                  </div>
                )}
                {evaluation.improvements && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Pontos a Melhorar</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{evaluation.improvements}</p>
                  </div>
                )}
                {evaluation.comments && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Comentários</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{evaluation.comments}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
