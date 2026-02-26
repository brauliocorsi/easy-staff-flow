import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, MessageSquare } from "lucide-react";
import type { MeetingAgenda } from "@/hooks/useMeetings";

interface AgendaCardProps {
  agenda: MeetingAgenda;
  index: number;
  editable?: boolean;
  onUpdateDecision?: (id: string, decision: string) => void;
}

export function AgendaCard({ agenda, index, editable, onUpdateDecision }: AgendaCardProps) {
  const [decision, setDecision] = useState(agenda.decision ?? "");
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdateDecision?.(agenda.id, decision);
    setEditing(false);
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {index + 1}
            </span>
            <h4 className="font-display font-semibold">{agenda.title}</h4>
          </div>
          {agenda.decision && !editing && (
            <Check className="h-4 w-4 text-success shrink-0" />
          )}
        </div>

        {agenda.description && (
          <p className="text-sm text-muted-foreground">{agenda.description}</p>
        )}

        {agenda.decision && !editing && (
          <div className="bg-muted rounded-md p-3 text-sm">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
              <MessageSquare className="h-3 w-3" /> Decisão
            </div>
            {agenda.decision}
          </div>
        )}

        {editable && !agenda.decision && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Registrar decisão
          </Button>
        )}

        {editable && editing && (
          <div className="space-y-2">
            <Textarea
              placeholder="O que foi decidido nesta pauta?"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
