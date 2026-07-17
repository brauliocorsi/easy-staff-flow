import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, KanbanSquare, List, GanttChart, FolderPlus, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useMuralProjects, useMuralTasks, useAdminUsers, useUpdateProject, useDeleteProject, type MuralTask, type MuralProject } from "@/hooks/useMural";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { computeSla, URGENCY_META } from "@/lib/muralSla";
import { ProjectFormDialog } from "@/components/mural/ProjectFormDialog";
import { TaskFormDialog } from "@/components/mural/TaskFormDialog";
import { MuralList } from "@/components/mural/MuralList";
import { MuralKanban } from "@/components/mural/MuralKanban";
import { MuralGantt } from "@/components/mural/MuralGantt";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

export default function Mural() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: projects = [] } = useMuralProjects();
  const { data: tasks = [] } = useMuralTasks(null);
  const { data: admins = [] } = useAdminUsers();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [projectDialog, setProjectDialog] = useState<{ open: boolean; project?: MuralProject | null }>({ open: false });
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; taskId?: string | null; projectId?: string | null }>({ open: false });

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (urgencyFilter !== "all" && t.urgency !== urgencyFilter) return false;
      if (assigneeFilter !== "all" && !t.assignees.some((a) => a.user_id === assigneeFilter)) return false;
      if (slaFilter !== "all") {
        const sla = computeSla(t.due_date, t.status, t.completed_at);
        if (sla.status !== slaFilter) return false;
      }
      return true;
    });
  }, [tasks, search, projectFilter, urgencyFilter, slaFilter, assigneeFilter]);

  if (adminLoading) return <AppLayout><div /></AppLayout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const projectsMini = projects.map((p) => ({ id: p.id, title: p.title, color: p.color }));

  const toggleArchive = async (p: MuralProject) => {
    await updateProject.mutateAsync({ id: p.id, archived: !p.archived });
    toast.success(p.archived ? "Projeto restaurado" : "Projeto arquivado");
  };

  const removeProject = async (p: MuralProject) => {
    if (!confirm(`Eliminar projeto "${p.title}" e todas as tarefas?`)) return;
    await deleteProject.mutateAsync(p.id);
    toast.success("Projeto eliminado");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Mural de Planejamento</h1>
            <p className="text-muted-foreground mt-1">Projetos, atividades e prazos partilhados entre a equipa de gestão.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setProjectDialog({ open: true, project: null })}>
              <FolderPlus className="h-4 w-4 mr-1" /> Novo projeto
            </Button>
            <Button onClick={() => setTaskDialog({ open: true, task: null })} disabled={activeProjects.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Nova tarefa
            </Button>
          </div>
        </div>

        {activeProjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeProjects.map((p) => {
              const count = tasks.filter((t) => t.project_id === p.id).length;
              return (
                <div key={p.id} className="group flex items-center gap-2 bg-card border rounded-lg pl-3 pr-1 py-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-sm font-medium">{p.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                  <div className="flex opacity-0 group-hover:opacity-100 transition">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setProjectDialog({ open: true, project: p })}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleArchive(p)}><Archive className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeProject(p)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
            {archivedProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-muted/50 border rounded-lg pl-3 pr-1 py-1 opacity-60">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="text-sm">{p.title} (arquivado)</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleArchive(p)}><ArchiveRestore className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar tarefa…" className="pl-8" />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.display_name ?? a.id.slice(0, 6)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer urgência</SelectItem>
                {Object.entries(URGENCY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={slaFilter} onValueChange={setSlaFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer SLA</SelectItem>
                <SelectItem value="on_track">No prazo</SelectItem>
                <SelectItem value="due_soon">A vencer</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="done_on_time">Concluídas no prazo</SelectItem>
                <SelectItem value="done_late">Concluídas em atraso</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5"><List className="h-4 w-4" />Lista</TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5"><KanbanSquare className="h-4 w-4" />Kanban</TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1.5"><GanttChart className="h-4 w-4" />Gantt</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-4">
            <MuralList tasks={filteredTasks} projects={projectsMini} admins={admins} onOpenTask={(t) => setTaskDialog({ open: true, taskId: t.id })} />
          </TabsContent>
          <TabsContent value="kanban" className="mt-4">
            <MuralKanban tasks={filteredTasks} projects={projectsMini} admins={admins} onOpenTask={(t) => setTaskDialog({ open: true, taskId: t.id })} />
          </TabsContent>
          <TabsContent value="gantt" className="mt-4">
            <MuralGantt tasks={filteredTasks} projects={projectsMini} onOpenTask={(t) => setTaskDialog({ open: true, taskId: t.id })} />
          </TabsContent>
        </Tabs>
      </div>

      <ProjectFormDialog
        open={projectDialog.open}
        onOpenChange={(o) => setProjectDialog({ open: o, project: o ? projectDialog.project : null })}
        project={projectDialog.project ?? null}
      />
      <TaskFormDialog
        open={taskDialog.open}
        onOpenChange={(o) => setTaskDialog({ open: o, taskId: o ? taskDialog.taskId : null })}
        task={taskDialog.taskId ? tasks.find((t) => t.id === taskDialog.taskId) ?? null : null}
        projectId={taskDialog.projectId ?? (projectFilter !== "all" ? projectFilter : null)}
        projects={activeProjects.map((p) => ({ id: p.id, title: p.title, color: p.color }))}
      />
    </AppLayout>
  );
}