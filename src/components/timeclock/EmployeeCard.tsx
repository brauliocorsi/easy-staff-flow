import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { TodayStatus } from "./TodayStatus";

export interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url: string | null;
  department: string | null;
  today_status: string;
}

interface Props {
  employee: EmployeeData;
  onClick: (employee: EmployeeData) => void;
}

export function EmployeeCard({ employee, onClick }: Props) {
  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      onClick={() => onClick(employee)}
    >
      <CardContent className="p-4 flex flex-col items-center text-center gap-3">
        <Avatar className="h-16 w-16">
          <AvatarImage src={employee.avatar_url || undefined} alt={employee.first_name} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="font-semibold text-sm text-foreground leading-tight">
            {employee.first_name} {employee.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{employee.position}</p>
          {employee.department && (
            <p className="text-xs text-muted-foreground">{employee.department}</p>
          )}
        </div>
        <TodayStatus status={employee.today_status} />
      </CardContent>
    </Card>
  );
}
