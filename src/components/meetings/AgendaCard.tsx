import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, MessageSquare, User } from "lucide-react";

interface Participant {
  employee_id: string;
  employees: { first_name: string; last_name: string } | null;
}

interface ResponsibleEmployee {
  employee_id: string;
  employees: { id: string; first_name: string; last_name: string } | null;
}

interface AgendaCardProps {
  agenda: {
    id: string;
    title: string;
    description: string | null;
    decision: string | null;
    responsible_employee_id?: string | null;
    responsible_employee?: { id: string; first_name: string; last_name: string } | null;
    responsibles?: ResponsibleEmployee[];
  };
  index: number;
  editable?: boolean;
  participants?: Participant[];
  onUpdateDecision?: (id: string, decision: string, responsibleEmployeeIds: string[]) => void;
}

export function AgendaCard({ agenda, index, editable, participants, onUpdateDecision }: AgendaCardProps) {
  const [decision, setDecision] = useState(agenda.decision ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (agenda.responsibles && agenda.responsibles.length > 0) {
      return agenda.responsibles.map((r) => r.employee_id);
    }
    if (agenda.responsible_employee_id) return [agenda.responsible_employee_id];
    return [];
  });
  const [allParticipants, setAllParticipants] = useState(() => {
    if (agenda.responsibles && agenda.responsibles.length === 0 && !agenda.responsible_employee_id && agenda.decision) return true;
    if (!agenda.decision) return true; // default for new
    return false;
  });
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    const ids = allParticipants ? [] : selectedIds;
    onUpdateDecision?.(agenda.id, decision, ids);
    setEditing(false);
  };

  const toggleEmployee = (empId: string) => {
    setAllParticipants(false);
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleToggleAll = () => {
    setAllParticipants(true);
    setSelectedIds([]);
  };

  // Build display names for responsibles
  const responsibleNames: string[] = [];
  if (agenda.responsibles && agenda.responsibles.length > 0) {
    for (const r of agenda.responsibles) {
      if (r.employees) responsibleNames.push(`${r.employees.first_name} ${r.employees.last_name}`);
    }
  } else if (agenda.responsible_employee) {
    responsibleNames.push(`${agenda.responsible_employee.first_name} ${agenda.responsible_employee.last_name}`);
  }

  const isAllResponsible = agenda.decision && responsibleNames.length === 0;

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
            <div className="flex items-center gap-1 text-xs text-primary font-medium mt-1 flex-wrap">
              <User className="h-3 w-3" />
              {isAllResponsible
                ? "Responsável: Todos os participantes"
                : `Responsável: ${responsibleNames.join(", ")}`}
            </div>
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
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Responsáveis</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={allParticipants}
                      onCheckedChange={() => handleToggleAll()}
                    />
                    Todos os participantes
                  </label>
                  {participants.map((p) => {
                    const emp = p.employees;
                    if (!emp) return null;
                    return (
                      <label key={p.employee_id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={!allParticipants && selectedIds.includes(p.employee_id)}
                          onCheckedChange={() => toggleEmployee(p.employee_id)}
                        />
                        {emp.first_name} {emp.last_name}
                      </label>
                    );
                  })}
                </div>
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
