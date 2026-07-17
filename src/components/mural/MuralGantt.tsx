import { useMemo } from "react";
import type { MuralTask } from "@/hooks/useMural";
import { URGENCY_META } from "@/lib/muralSla";

interface Props {
  tasks: MuralTask[];
  projects: { id: string; title: string; color: string }[];
  onOpenTask: (t: MuralTask) => void;
}

const URGENCY_COLOR: Record<string, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f97316",
  critical: "#ef4444",
};

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function MuralGantt({ tasks, projects, onOpenTask }: Props) {
  const visible = tasks.filter((t) => t.start_date || t.due_date);

  const { min, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates: Date[] = [today];
    visible.forEach((t) => {
      if (t.start_date) dates.push(new Date(t.start_date));
      if (t.due_date) dates.push(new Date(t.due_date));
    });
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 2);
    return { min, totalDays: Math.max(1, daysBetween(min, max)) };
  }, [visible]);

  const DAY_WIDTH = 24;
  const width = totalDays * DAY_WIDTH;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = daysBetween(min, today) * DAY_WIDTH;

  const grouped = useMemo(() => {
    const map = new Map<string, MuralTask[]>();
    visible.forEach((t) => {
      const arr = map.get(t.project_id) ?? [];
      arr.push(t);
      map.set(t.project_id, arr);
    });
    return Array.from(map.entries());
  }, [visible]);

  if (visible.length === 0) {
    return <div className="text-center text-muted-foreground py-12 border rounded-lg">Nenhuma tarefa com datas.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex">
        <div className="w-64 shrink-0 border-r bg-muted/30">
          <div className="h-10 border-b px-3 flex items-center text-xs font-medium text-muted-foreground">Tarefa</div>
          {grouped.map(([pid, arr]) => {
            const proj = projects.find((p) => p.id === pid);
            return (
              <div key={pid}>
                <div className="h-7 px-3 flex items-center gap-1.5 bg-muted/50 border-b text-xs font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ background: proj?.color }} />
                  {proj?.title ?? "Projeto"}
                </div>
                {arr.map((t) => (
                  <div key={t.id} onClick={() => onOpenTask(t)} className="h-8 px-3 flex items-center border-b text-xs truncate cursor-pointer hover:bg-muted/50">
                    {t.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div style={{ width, position: "relative" }}>
            <div className="h-10 border-b flex text-[10px] text-muted-foreground">
              {Array.from({ length: totalDays }).map((_, i) => {
                const d = new Date(min);
                d.setDate(d.getDate() + i);
                const isFirst = d.getDate() === 1 || i === 0;
                return (
                  <div key={i} style={{ width: DAY_WIDTH }} className={`border-r flex items-center justify-center ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/40" : ""}`}>
                    {isFirst ? <span className="font-medium">{d.toLocaleDateString("pt-PT", { month: "short", day: "numeric" })}</span> : <span>{d.getDate()}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ left: todayX, position: "absolute", top: 40, bottom: 0, width: 2, background: "hsl(var(--primary))" }} />
            {grouped.map(([pid, arr]) => (
              <div key={pid}>
                <div className="h-7 border-b bg-muted/50" />
                {arr.map((t) => {
                  const s = t.start_date ? new Date(t.start_date) : t.due_date ? new Date(t.due_date) : min;
                  const e = t.due_date ? new Date(t.due_date) : t.start_date ? new Date(t.start_date!) : min;
                  const x = daysBetween(min, s) * DAY_WIDTH;
                  const w = Math.max(DAY_WIDTH, (daysBetween(s, e) + 1) * DAY_WIDTH);
                  const color = URGENCY_COLOR[t.urgency] ?? "#3b82f6";
                  const doneStyle = t.status === "done"
                    ? { backgroundImage: `repeating-linear-gradient(45deg, ${color}, ${color} 4px, ${color}cc 4px, ${color}cc 8px)` }
                    : { background: color };
                  return (
                    <div key={t.id} className="h-8 relative border-b">
                      <div
                        onClick={() => onOpenTask(t)}
                        title={`${t.title} • ${URGENCY_META[t.urgency]?.label}`}
                        style={{ left: x, width: w, top: 6, height: 20, position: "absolute", ...doneStyle }}
                        className="rounded cursor-pointer hover:opacity-80 flex items-center px-1.5 text-[10px] text-white font-medium truncate"
                      >
                        {t.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}