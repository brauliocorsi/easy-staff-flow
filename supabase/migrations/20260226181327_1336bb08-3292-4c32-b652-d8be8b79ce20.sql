
-- Storage bucket for equipment signed files
INSERT INTO storage.buckets (id, name, public) VALUES ('equipment', 'equipment', true);

-- Storage policies for equipment bucket
CREATE POLICY "Equipment files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'equipment');

CREATE POLICY "Admins can upload equipment files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'equipment' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update equipment files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'equipment' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete equipment files"
ON storage.objects FOR DELETE
USING (bucket_id = 'equipment' AND public.is_admin(auth.uid()));

-- 1. EPI Deliveries
CREATE TABLE public.epi_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  signed_file_url text,
  notes text,
  status text NOT NULL DEFAULT 'delivered',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage epi_deliveries"
ON public.epi_deliveries FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own epi_deliveries"
ON public.epi_deliveries FOR SELECT
USING (public.can_access_employee(auth.uid(), employee_id));

-- 2. Tool Assignments
CREATE TABLE public.tool_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  serial_number text,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  returned_date date,
  condition text NOT NULL DEFAULT 'new',
  signed_file_url text,
  notes text,
  status text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tool_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tool_assignments"
ON public.tool_assignments FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own tool_assignments"
ON public.tool_assignments FOR SELECT
USING (public.can_access_employee(auth.uid(), employee_id));

-- 3. Machines
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  description text,
  checklist_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage machines"
ON public.machines FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Everyone can view machines"
ON public.machines FOR SELECT
USING (true);

-- 4. Maintenance Tasks
CREATE TABLE public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'weekly',
  day_of_week integer,
  day_of_month integer,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage maintenance_tasks"
ON public.maintenance_tasks FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own maintenance_tasks"
ON public.maintenance_tasks FOR SELECT
USING (public.can_access_employee(auth.uid(), employee_id));

-- 5. Maintenance Logs
CREATE TABLE public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  checklist_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage maintenance_logs"
ON public.maintenance_logs FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own maintenance_logs"
ON public.maintenance_logs FOR SELECT
USING (public.can_access_employee(auth.uid(), employee_id));
