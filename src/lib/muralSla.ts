export type SlaStatus = "none" | "on_track" | "due_soon" | "overdue" | "done_on_time" | "done_late";

export interface SlaInfo {
  status: SlaStatus;
  label: string;
  daysLeft: number | null;
  colorClass: string;
}

export function computeSla(
  dueDate: string | null | undefined,
  status: string,
  completedAt: string | null | undefined,
  now: Date = new Date()
): SlaInfo {
  if (!dueDate) {
    return { status: "none", label: "Sem prazo", daysLeft: null, colorClass: "bg-muted text-muted-foreground" };
  }
  const due = new Date(dueDate + "T23:59:59");
  if (status === "done") {
    if (completedAt && new Date(completedAt) > due) {
      return { status: "done_late", label: "Concluído em atraso", daysLeft: null, colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
    }
    return { status: "done_on_time", label: "Concluído no prazo", daysLeft: null, colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
  }
  const msPerDay = 86400000;
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / msPerDay);
  if (daysLeft < 0) {
    return { status: "overdue", label: `Vencida há ${Math.abs(daysLeft)}d`, daysLeft, colorClass: "bg-destructive/15 text-destructive" };
  }
  if (daysLeft <= 3) {
    return { status: "due_soon", label: daysLeft === 0 ? "Vence hoje" : `Faltam ${daysLeft}d`, daysLeft, colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
  }
  return { status: "on_track", label: `Faltam ${daysLeft}d`, daysLeft, colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
}

export const URGENCY_META: Record<string, { label: string; colorClass: string }> = {
  low: { label: "Baixa", colorClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  medium: { label: "Média", colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  high: { label: "Alta", colorClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  critical: { label: "Crítica", colorClass: "bg-destructive/15 text-destructive" },
};

export const STATUS_META: Record<string, { label: string; colorClass: string }> = {
  todo: { label: "A fazer", colorClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  in_progress: { label: "Em curso", colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  blocked: { label: "Bloqueado", colorClass: "bg-destructive/15 text-destructive" },
  done: { label: "Concluído", colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};