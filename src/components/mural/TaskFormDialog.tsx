import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, X } from "lucide-react";
import { useCreateTask, useUpdateTask, useDeleteTask, useAdminUsers, type MuralTask } from "@/hooks/useMural";
import { URGENCY_META, STATUS_META } from "@/lib/muralSla";
import { TaskChecklist } from "./TaskChecklist";
import { TaskComments } from "./TaskComments";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: MuralTask | null;
  projectId?: string | null;
  projects: { id: string; title: string; color: string }[];
}

export function TaskFormDialog({ open, onOpenChange, task, projectId, projects }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("todo");
  const [urgency, setUrgency] = useState<string>("medium");
  const [difficulty, setDifficulty] = useState<number>(3);
  const [effortHours, setEffortHours] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const { data: admins = [] } = useAdminUsers();

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? "todo");
      setUrgency(task?.urgency ?? "medium");
      setDifficulty(task?.difficulty ?? 3);
      setEffortHours(task?.effort_hours != null ? String(task.effort_hours) : "");
      setStartDate(task?.start_date ?? "");
      setDueDate(task?.due_date ?? "");
      setSelectedProject(task?.project_id ?? projectId ?? projects[0]?.id ?? "");
      setAssignees(task?.assignees?.map((a) => a.user_id) ?? []);
      setTags(task?.tags ?? []);
      setTagInput("");
    }
  }, [open, task, projectId, projects]);

  const toggleAssignee = (id: string) => {
    setAssignees((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (!title.trim() || !selectedProject) {
      toast.error("Título e projeto são obrigatórios");
      return;
    }
    const payload = {
      title,
      description: description || null,
      status,
      urgency,
      difficulty,
      effort_hours: effortHours ? Number(effortHours) : null,
      start_date: startDate || null,
      due_date: dueDate || null,
      project_id: selectedProject,
      tags,
      assignee_ids: assignees,
    };
    try {
      if (task) {
        await update.mutateAsync({ id: task.id, ...payload });
        toast.success("Tarefa atualizada");
      } else {
        await create.mutateAsync(payload as never);
        toast.success("Tarefa criada");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm("Eliminar esta tarefa?")) return;
    await del.mutateAsync(task.id);
    toast.success("Tarefa eliminada");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task ? "Editar tarefa" : "Nova tarefa"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(URGENCY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dificuldade</Label>
              <Select value={String(difficulty)} onValueChange={(v) => setDifficulty(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{"★".repeat(n)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Esforço (h)</Label>
              <Input type="number" step="0.5" min="0" value={effortHours} onChange={(e) => setEffortHours(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <div className="flex flex-wrap gap-2">
              {admins.map((a) => {
                const active = assignees.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAssignee(a.id)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                  >
                    {a.display_name ?? a.id.slice(0, 6)}
                  </button>
                );
              })}
              {admins.length === 0 && <p className="text-xs text-muted-foreground">Sem admins disponíveis</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Adicionar etiqueta…" />
              <Button variant="outline" onClick={addTag}>Adicionar</Button>
            </div>
          </div>

          {task && (
            <>
              <div className="border-t pt-4">
                <TaskChecklist taskId={task.id} items={task.checklist ?? []} />
              </div>
              <div className="border-t pt-4">
                <TaskComments taskId={task.id} />
              </div>
            </>
          )}
        </div>
        <div className="sticky bottom-0 bg-background border-t -mx-6 px-6 py-3 flex justify-between">
          <div>
            {task && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim()}>Guardar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}