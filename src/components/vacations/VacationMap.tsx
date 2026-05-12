import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { VacationRequest } from "@/hooks/useVacations";
import { format } from "date-fns";
import { useHolidays } from "@/hooks/useHolidays";

interface Props {
  vacations: VacationRequest[];
  year: number;
  isLoading: boolean;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const categoryColors: Record<string, string> = {
  individual: "bg-primary",
  factory: "bg-info",
  warehouse: "bg-warning",
};

const statusOpacity: Record<string, string> = {
  pending: "opacity-40",
  employee_suggested: "opacity-60",
  approved: "opacity-90",
  rejected: "opacity-20 line-through",
};

interface EmployeeRow {
  id: string;
  name: string;
  requests: VacationRequest[];
  totalEntitled: number;
  enjoyedDays: number;
  approvedDays: number;
  remaining: number;
}

function getDayOfYear(dateStr: string, year: number): number {
  const d = new Date(dateStr + "T00:00:00");
  const start = new Date(year, 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function getDaysInYear(year: number): number {
  return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
}

function getMonthStartDay(year: number, month: number): number {
  const d = new Date(year, month, 1);
  const start = new Date(year, 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

export function VacationMap({ vacations, year, isLoading }: Props) {
  const totalDays = getDaysInYear(year);
  const dayWidth = 3; // px per day
  const timelineWidth = totalDays * dayWidth;
  const nameColWidth = 240;
  const { isHoliday } = useHolidays();

  // Pre-compute background segments per day-of-year (weekend/holiday)
  const dayBackgrounds = useMemo(() => {
    const arr: Array<"weekend" | "holiday" | null> = [];
    const start = new Date(year, 0, 1);
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = format(d, "yyyy-MM-dd");
      if (isHoliday(iso)) arr.push("holiday");
      else {
        const dow = d.getDay();
        arr.push(dow === 0 || dow === 6 ? "weekend" : null);
      }
    }
    return arr;
  }, [year, totalDays, isHoliday]);

  const employees = useMemo<EmployeeRow[]>(() => {
    const map = new Map<string, EmployeeRow>();
    for (const v of vacations) {
      if ((v as any).sell_status) continue;
      if (!map.has(v.employee_id)) {
        const name = v.employees
          ? `${v.employees.first_name} ${v.employees.last_name}`
          : "—";
        map.set(v.employee_id, {
          id: v.employee_id,
          name,
          requests: [],
          totalEntitled: 0,
          enjoyedDays: 0,
          approvedDays: 0,
          remaining: 0,
        });
      }
      const row = map.get(v.employee_id)!;
      row.requests.push(v);
      if (v.total_entitled_days > row.totalEntitled) row.totalEntitled = v.total_entitled_days;
      if (v.status === "approved" || v.enjoyed) row.approvedDays += v.days_count;
      if (v.enjoyed) row.enjoyedDays += v.days_count;
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        totalEntitled: r.totalEntitled || 22,
        remaining: Math.max(0, (r.totalEntitled || 22) - r.approvedDays),
        requests: [...r.requests].sort((a, b) => a.start_date.localeCompare(b.start_date)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vacations]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">A carregar mapa...</CardContent>
      </Card>
    );
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum pedido de férias para {year}.
        </CardContent>
      </Card>
    );
  }

  // Current day marker
  const today = new Date();
  const todayDoy = today.getFullYear() === year ? getDayOfYear(format(today, "yyyy-MM-dd"), year) : -1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg">Mapa Anual — {year}</CardTitle>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary" /> Individual
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-info" /> Fábrica
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-warning" /> Armazém
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-muted" /> Fim de semana
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-destructive/20" /> Feriado
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground" /> Pendente
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            {/* Month headers */}
            <div className="flex border-b sticky top-0 bg-card z-10">
              <div
                className="shrink-0 border-r px-3 py-2 text-xs font-medium text-muted-foreground"
                style={{ width: nameColWidth }}
              >
                Funcionário
              </div>
              <div className="relative" style={{ width: timelineWidth }}>
                {MONTHS.map((m, i) => {
                  const startDay = getMonthStartDay(year, i);
                  const nextStart = i < 11 ? getMonthStartDay(year, i + 1) : totalDays;
                  const width = (nextStart - startDay) * dayWidth;
                  return (
                    <div
                      key={m}
                      className="absolute top-0 h-full border-r flex items-center justify-center text-xs font-medium text-muted-foreground"
                      style={{ left: startDay * dayWidth, width }}
                    >
                      {m}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Employee rows */}
            {employees.map((emp, empIdx) => (
              <div
                key={emp.id}
                className={`flex border-b last:border-b-0 hover:bg-muted/30 transition-colors ${empIdx % 2 === 0 ? "" : "bg-muted/10"}`}
              >
                <div
                  className="shrink-0 border-r px-3 py-2 flex items-center text-xs font-medium truncate"
                  style={{ width: nameColWidth }}
                  title={emp.name}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{emp.name}</span>
                    <div className="flex gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="text-[10px] bg-success text-success-foreground h-4 px-1">
                            {emp.enjoyedDays}g
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{emp.enjoyedDays} dias gozados</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {emp.remaining}r
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{emp.remaining} dias restantes (de {emp.totalEntitled})</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <div className="relative" style={{ width: timelineWidth, height: 36 }}>
                  {/* Weekend / holiday backgrounds */}
                  {dayBackgrounds.map((kind, i) =>
                    kind ? (
                      <div
                        key={`bg-${i}`}
                        className={
                          kind === "holiday"
                            ? "absolute top-0 h-full bg-destructive/15"
                            : "absolute top-0 h-full bg-muted/40"
                        }
                        style={{ left: i * dayWidth, width: dayWidth }}
                      />
                    ) : null
                  )}
                  {/* Month grid lines */}
                  {MONTHS.map((_, i) => {
                    const startDay = getMonthStartDay(year, i);
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-r border-border/30"
                        style={{ left: startDay * dayWidth }}
                      />
                    );
                  })}

                  {/* Today marker */}
                  {todayDoy >= 0 && (
                    <div
                      className="absolute top-0 h-full w-px bg-destructive/50 z-10"
                      style={{ left: todayDoy * dayWidth }}
                    />
                  )}

                  {/* Vacation bars */}
                  {emp.requests.map((v) => {
                    const startDoy = getDayOfYear(v.start_date, year);
                    const endDoy = getDayOfYear(v.end_date, year);
                    const barWidth = Math.max((endDoy - startDoy + 1) * dayWidth, dayWidth);
                    const colorClass = categoryColors[v.category] || "bg-primary";
                    const opacityClass = statusOpacity[v.status] || "opacity-80";
                    const isEnjoyed = v.enjoyed;

                    return (
                      <Tooltip key={v.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-1.5 h-5 rounded-sm cursor-pointer transition-all hover:brightness-110 ${colorClass} ${opacityClass} ${isEnjoyed ? "ring-1 ring-offset-1 ring-success" : ""}`}
                            style={{
                              left: startDoy * dayWidth,
                              width: barWidth,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          <div className="space-y-0.5">
                            <p className="font-medium">{emp.name}</p>
                            <p>
                              {format(new Date(v.start_date + "T00:00:00"), "dd/MM")} — {format(new Date(v.end_date + "T00:00:00"), "dd/MM/yyyy")}
                            </p>
                            <p>{v.days_count} dias úteis</p>
                            <div className="flex gap-1 pt-0.5">
                              <Badge variant="outline" className="text-[10px] capitalize">{v.category}</Badge>
                              <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
                              {v.enjoyed && <Badge className="text-[10px] bg-success text-success-foreground">Gozada</Badge>}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
