
-- Create employee_evaluations table
CREATE TABLE public.employee_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rating integer,
  performance_rating integer,
  teamwork_rating integer,
  punctuality_rating integer,
  communication_rating integer,
  strengths text,
  improvements text,
  comments text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_evaluations ENABLE ROW LEVEL SECURITY;

-- Admins can manage all evaluations
CREATE POLICY "Admins can manage evaluations"
ON public.employee_evaluations
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Evaluators can view their assigned evaluations
CREATE POLICY "Evaluators can view assigned evaluations"
ON public.employee_evaluations
FOR SELECT
TO authenticated
USING (evaluator_id = public.get_employee_id_for_user(auth.uid()));

-- Evaluators can update their assigned evaluations
CREATE POLICY "Evaluators can update assigned evaluations"
ON public.employee_evaluations
FOR UPDATE
TO authenticated
USING (evaluator_id = public.get_employee_id_for_user(auth.uid()));
