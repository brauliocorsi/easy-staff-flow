import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

interface Participant {
  id: string;
  employee_id: string;
  present?: boolean;
  employees: {
    first_name: string;
    last_name: string;
    position: string;
    email: string;
  } | null;
}

interface ParticipantsListProps {
  participants: Participant[];
  showEmail?: boolean;
  editable?: boolean;
  onTogglePresence?: (participantId: string, present: boolean) => void;
}

export function ParticipantsList({ participants, showEmail, editable, onTogglePresence }: ParticipantsListProps) {
  return (
    <div className="space-y-2">
      {participants.map((p) => {
        const emp = p.employees;
        if (!emp) return null;
        const initials = `${emp.first_name[0]}${emp.last_name[0]}`;
        return (
          <div key={p.employee_id} className="flex items-center gap-3">
            {editable && (
              <Checkbox
                checked={p.present ?? false}
                onCheckedChange={(checked) =>
                  onTogglePresence?.(p.id, checked === true)
                }
              />
            )}
            {!editable && p.present !== undefined && (
              <span className={`h-2 w-2 rounded-full shrink-0 ${p.present ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
            )}
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium">
                {emp.first_name} {emp.last_name}
              </p>
              <p className="text-muted-foreground text-xs">
                {emp.position}
                {showEmail && ` · ${emp.email}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
