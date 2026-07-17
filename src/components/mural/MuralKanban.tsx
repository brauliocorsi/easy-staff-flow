import { Badge } from "@/components/ui/badge";
import { computeSla, URGENCY_META, STATUS_META } from "@/lib/muralSla";
import type { MuralTask } from "@/hooks/useMural";
import { useUpdateTask } from "@/hooks/useMural";
import { useState } from "react";

interface Props {
  tasks: MuralTask[];
  projects: { id: string; title: string; color: string }[];
  admins: { id: string; display_name: string | null }[];
  onOpenTask: (t: MuralTask) => void;
}

const COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "A fazer" },
  { key: "in_progress", label: "Em curso" },
  { key: "blocked", label: "Bloqueado" },
  { key: "done", label: "Concluído" },
];

export function MuralKanban({ tasks, projects, admins, onOpenTask }: Props) {
  const update = useUpdateTask();
  const [dragging, setDragging] = useState<string | null>(null);

  const projectOf = (id: string) => projects.find((p) => p.id === id);
  const adminOf = (id: string) => admins.find((a) => a.id === id);

  const handleDrop = (status: string) => {
    if (!dragging) return;
    const t = tasks.find((x) => x.id === dragging);
    if (t && t.status !== status) {
      update.mutate({ id: t.id, status });
    }
    setDragging(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
            className="bg-muted/30 rounded-lg p-3 min-h-[400px]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_META[col.key]?.colorClass}>{col.label}</Badge>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
              </div>
            </div>
            <div className="space-y-2">
              {colTasks.map((t) => {
                const proj = projectOf(t.project_id);
                const sla = computeSla(t.due_date, t.status, t.completed_at);
                const total = t.checklist?.length ?? 0;
                const done = t.checklist?.filter((c) => c.done).length ?? 0;
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onClick={() => onOpenTask(t)}
                    className="bg-card border rounded-md p-3 cursor-pointer hover:shadow-md transition space-y-2"
                    style={{ borderLeftWidth: 3, borderLeftColor: proj?.color ?? "hsl(var(--border))" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{t.title}</p>
                      <Badge variant="outline" className={`${URGENCY_META[t.urgency]?.colorClass} text-[10px] shrink-0`}>
                        {URGENCY_META[t.urgency]?.label}
                      </Badge>
                    </div>
                    {proj && <p className="text-[11px] text-muted-foreground">{proj.title}</p>}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{"★".repeat(t.difficulty)}</span>
                      {total > 0 && <span className="text-muted-foreground">{done}/{total}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-1">
                        {t.assignees.slice(0, 3).map((a) => {
                          const u = adminOf(a.user_id);
                          const name = u?.display_name ?? "?";
                          return (
                            <div key={a.user_id} title={name} className="h-5 w-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[9px] font-medium">
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                          );
                        })}
                      </div>
                      <Badge variant="outline" className={`${sla.colorClass} text-[10px]`}>{sla.label}</Badge>
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Vazio</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}