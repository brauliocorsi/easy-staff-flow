import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MoonStar, AlertTriangle, Palmtree } from "lucide-react";
import { TodayStatus } from "./TodayStatus";
import { useMemo } from "react";

export interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url: string | null;
  department: string | null;
  today_status: string;
  schedule_label?: string | null;
  scheduled_clock_in?: string | null;
  scheduled_lunch_out?: string | null;
  scheduled_lunch_in?: string | null;
  scheduled_clock_out?: string | null;
  tolerance_late_minutes?: number | null;
  is_part_time?: boolean;
  on_vacation?: boolean;
}

interface Props {
  employee: EmployeeData;
  onClick: (employee: EmployeeData) => void;
}

function isLate(employee: EmployeeData): boolean {
  const { today_status, tolerance_late_minutes } = employee;
  if (!tolerance_late_minutes && tolerance_late_minutes !== 0) return false;
  if (today_status === "complete") return false;

  const statusToSchedule: Record<string, string | null | undefined> = {
    clock_in: employee.scheduled_clock_in,
    lunch_out: employee.scheduled_lunch_out,
    lunch_in: employee.scheduled_lunch_in,
    clock_out: employee.scheduled_clock_out,
  };

  const scheduledTime = statusToSchedule[today_status];
  if (!scheduledTime) return false;

  const [h, m] = scheduledTime.split(":").map(Number);
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(h, m + (tolerance_late_minutes ?? 0), 0, 0);

  return now > scheduled;
}

const NEXT_ACTION: Record<string, string> = {
  clock_in: "Próximo: registar entrada",
  lunch_out: "Próximo: saída para almoço",
  lunch_in: "Próximo: regresso do almoço",
  clock_out: "Próximo: registar saída",
  complete: "Dia concluído",
};

/** Dia por fechar: já passou a hora de saída e falta a última picagem. */
function isIncomplete(employee: EmployeeData): boolean {
  if (employee.today_status === "complete") return false;
  const out = employee.scheduled_clock_out;
  if (!out) return false;
  const [h, m] = out.split(":").map(Number);
  const limit = new Date();
  limit.setHours(h, m + 60, 0, 0);
  return new Date() > limit;
}

export function EmployeeCard({ employee, onClick }: Props) {
  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  const isDayOff = employee.schedule_label?.includes("Folga");
  const isOnVacation = employee.on_vacation;
  const incomplete = useMemo(
    () => !isDayOff && !isOnVacation && isIncomplete(employee),
    [employee, isDayOff, isOnVacation],
  );
  const late = useMemo(() => !isDayOff && !isOnVacation && isLate(employee), [employee, isDayOff, isOnVacation]);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
        isOnVacation ? "opacity-60 border-dashed border-success/40" : ""
      } ${isDayOff && !isOnVacation ? "opacity-60 border-dashed border-muted-foreground/30" : ""
      } ${late ? "border-destructive bg-destructive/5 shadow-destructive/20" : ""}`}
      onClick={() => onClick(employee)}
    >
      <CardContent className="p-4 flex flex-col items-center text-center gap-3 relative">
        {isOnVacation && (
          <Badge variant="outline" className="absolute top-2 right-2 text-[10px] gap-1 border-success/40 text-success bg-success/10">
            <Palmtree className="h-3 w-3" />
            Férias
          </Badge>
        )}
        {isDayOff && !isOnVacation && (
          <Badge variant="outline" className="absolute top-2 right-2 text-[10px] gap-1 border-warning/40 text-warning bg-warning/10">
            <MoonStar className="h-3 w-3" />
            Folga
          </Badge>
        )}
        {late && !isOnVacation && (
          <Badge variant="destructive" className="absolute top-2 right-2 text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" />
            Atrasado
          </Badge>
        )}
        <Avatar className="h-16 w-16">
          <AvatarImage src={employee.avatar_url || undefined} alt={employee.first_name} />
          <AvatarFallback className={`font-semibold text-lg ${isDayOff ? "bg-muted text-muted-foreground" : late ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
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
        {!isDayOff && !isOnVacation && (
          <div className="flex flex-col items-center gap-1">
            <TodayStatus status={employee.today_status} late={late} />
            <p className="text-xs font-medium text-muted-foreground">
              {NEXT_ACTION[employee.today_status] ?? NEXT_ACTION.clock_in}
            </p>
            {incomplete && (
              <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Falta uma picagem hoje
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
