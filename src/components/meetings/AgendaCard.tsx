import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, MessageSquare, User } from "lucide-react";

interface Participant {
  employee_id: string;
  employees: { first_name: string; last_name: string } | null;
}

interface AgendaCardProps {
  agenda: {
    id: string;
    title: string;
    description: string | null;
    decision: string | null;
    responsible_employee_id?: string | null;
    responsible_employee?: { id: string; first_name: string; last_name: string } | null;
  };
  index: number;
  editable?: boolean;
  participants?: Participant[];
  onUpdateDecision?: (id: string, decision: string, responsibleEmployeeId: string | null) => void;
}

export function AgendaCard({ agenda, index, editable, participants, onUpdateDecision }: AgendaCardProps) {
  const [decision, setDecision] = useState(agenda.decision ?? "");
  const [responsibleId, setResponsibleId] = useState<string>(agenda.responsible_employee_id ?? "all");
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdateDecision?.(agenda.id, decision, responsibleId === "all" ? null : responsibleId);
    setEditing(false);
  };

  const responsibleName = agenda.responsible_employee
    ? `${agenda.responsible_employee.first_name} ${agenda.responsible_employee.last_name}`
    : null;

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
          <div className="bg-muted rounded-md p-3 text-sm space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MessageSquare className="h-3 w-3" /> Decisão
            </div>
            <p>{agenda.decision}</p>
            {(responsibleName || agenda.responsible_employee_id === null) && agenda.decision && (
              <div className="flex items-center gap-1 text-xs text-primary font-medium mt-1">
                <User className="h-3 w-3" />
                {responsibleName ? `Responsável: ${responsibleName}` : "Responsável: Todos os participantes"}
              </div>
            )}
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
            {participants && participants.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                <Select value={responsibleId} onValueChange={setResponsibleId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os participantes</SelectItem>
                    {participants.map((p) => {
                      const emp = p.employees;
                      if (!emp) return null;
                      return (
                        <SelectItem key={p.employee_id} value={p.employee_id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
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
