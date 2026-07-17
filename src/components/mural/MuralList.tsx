import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { computeSla, URGENCY_META, STATUS_META } from "@/lib/muralSla";
import type { MuralTask } from "@/hooks/useMural";

interface Props {
  tasks: MuralTask[];
  projects: { id: string; title: string; color: string }[];
  admins: { id: string; display_name: string | null }[];
  onOpenTask: (t: MuralTask) => void;
}

export function MuralList({ tasks, projects, admins, onOpenTask }: Props) {
  const projectOf = (id: string) => projects.find((p) => p.id === id);
  const adminOf = (id: string) => admins.find((a) => a.id === id);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead>Projeto</TableHead>
            <TableHead>Responsáveis</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Urgência</TableHead>
            <TableHead>Dif.</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Progresso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 && (
            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma tarefa.</TableCell></TableRow>
          )}
          {tasks.map((t) => {
            const proj = projectOf(t.project_id);
            const sla = computeSla(t.due_date, t.status, t.completed_at);
            const total = t.checklist?.length ?? 0;
            const done = t.checklist?.filter((c) => c.done).length ?? 0;
            const pct = total > 0 ? (done / total) * 100 : t.status === "done" ? 100 : 0;
            return (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpenTask(t)}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell>
                  {proj && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: proj.color }} />
                      {proj.title}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex -space-x-1">
                    {t.assignees.slice(0, 3).map((a) => {
                      const u = adminOf(a.user_id);
                      const name = u?.display_name ?? "?";
                      return (
                        <div key={a.user_id} title={name} className="h-6 w-6 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[10px] font-medium">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className={STATUS_META[t.status]?.colorClass}>{STATUS_META[t.status]?.label}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={URGENCY_META[t.urgency]?.colorClass}>{URGENCY_META[t.urgency]?.label}</Badge></TableCell>
                <TableCell>{"★".repeat(t.difficulty)}</TableCell>
                <TableCell className="text-sm">{t.due_date ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className={sla.colorClass}>{sla.label}</Badge></TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5" />
                    <span className="text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}