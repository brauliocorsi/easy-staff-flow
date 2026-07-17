
-- Projects
CREATE TABLE public.mural_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_projects TO authenticated;
GRANT ALL ON public.mural_projects TO service_role;
ALTER TABLE public.mural_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mural_projects" ON public.mural_projects
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Tasks
CREATE TABLE public.mural_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.mural_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done')),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low','medium','high','critical')),
  difficulty INT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  effort_hours NUMERIC(6,2),
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  order_index INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mural_tasks_project ON public.mural_tasks(project_id);
CREATE INDEX idx_mural_tasks_status ON public.mural_tasks(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_tasks TO authenticated;
GRANT ALL ON public.mural_tasks TO service_role;
ALTER TABLE public.mural_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mural_tasks" ON public.mural_tasks
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Assignees
CREATE TABLE public.mural_task_assignees (
  task_id UUID NOT NULL REFERENCES public.mural_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX idx_mural_assignees_user ON public.mural_task_assignees(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_task_assignees TO authenticated;
GRANT ALL ON public.mural_task_assignees TO service_role;
ALTER TABLE public.mural_task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mural_task_assignees" ON public.mural_task_assignees
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Checklist items
CREATE TABLE public.mural_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.mural_tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mural_checklist_task ON public.mural_checklist_items(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_checklist_items TO authenticated;
GRANT ALL ON public.mural_checklist_items TO service_role;
ALTER TABLE public.mural_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mural_checklist_items" ON public.mural_checklist_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Comments
CREATE TABLE public.mural_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.mural_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mural_comments_task ON public.mural_comments(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_comments TO authenticated;
GRANT ALL ON public.mural_comments TO service_role;
ALTER TABLE public.mural_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mural_comments" ON public.mural_comments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- updated_at triggers
CREATE TRIGGER mural_projects_updated BEFORE UPDATE ON public.mural_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mural_tasks_updated BEFORE UPDATE ON public.mural_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mural_checklist_updated BEFORE UPDATE ON public.mural_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
