import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Participant {
  employee_id: string;
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
}

export function ParticipantsList({ participants, showEmail }: ParticipantsListProps) {
  return (
    <div className="space-y-2">
      {participants.map((p) => {
        const emp = p.employees;
        if (!emp) return null;
        const initials = `${emp.first_name[0]}${emp.last_name[0]}`;
        return (
          <div key={p.employee_id} className="flex items-center gap-3">
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
