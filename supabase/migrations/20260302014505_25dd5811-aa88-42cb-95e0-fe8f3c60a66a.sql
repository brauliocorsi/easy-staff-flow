
CREATE TABLE public.medical_exams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_date date NOT NULL DEFAULT CURRENT_DATE,
  exam_type text NOT NULL DEFAULT 'periodic',
  result text NOT NULL DEFAULT 'fit',
  provider text,
  doctor_name text,
  file_url text,
  notes text,
  next_exam_date date,
  year integer NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage medical_exams"
  ON public.medical_exams FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own medical_exams"
  ON public.medical_exams FOR SELECT
  USING (public.can_access_employee(auth.uid(), employee_id));
