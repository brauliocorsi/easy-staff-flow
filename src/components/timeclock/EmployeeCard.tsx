import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MoonStar } from "lucide-react";
import { TodayStatus } from "./TodayStatus";

export interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url: string | null;
  department: string | null;
  today_status: string;
  schedule_label?: string | null;
}

interface Props {
  employee: EmployeeData;
  onClick: (employee: EmployeeData) => void;
}

export function EmployeeCard({ employee, onClick }: Props) {
  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  const isDayOff = employee.schedule_label?.includes("Folga");

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
        isDayOff ? "opacity-60 border-dashed border-muted-foreground/30" : ""
      }`}
      onClick={() => onClick(employee)}
    >
      <CardContent className="p-4 flex flex-col items-center text-center gap-3 relative">
        {isDayOff && (
          <Badge variant="outline" className="absolute top-2 right-2 text-[10px] gap-1 border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
            <MoonStar className="h-3 w-3" />
            Folga
          </Badge>
        )}
        <Avatar className="h-16 w-16">
          <AvatarImage src={employee.avatar_url || undefined} alt={employee.first_name} />
          <AvatarFallback className={`font-semibold text-lg ${isDayOff ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
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
          {employee.schedule_label && !isDayOff && (
            <p className="text-xs text-primary/80 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {employee.schedule_label}
            </p>
          )}
        </div>
        {!isDayOff && <TodayStatus status={employee.today_status} />}
      </CardContent>
    </Card>
  );
}
