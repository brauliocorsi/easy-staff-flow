
-- Table for corrective maintenance / external repairs
CREATE TABLE public.machine_repairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.employees(id),
  repair_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  parts_replaced TEXT,
  company_name TEXT,
  technician_name TEXT,
  cost NUMERIC,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.machine_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage machine_repairs"
  ON public.machine_repairs FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view machine_repairs"
  ON public.machine_repairs FOR SELECT
  USING (is_manager_or_admin(auth.uid()));
