
-- Create employee_trainings table
CREATE TABLE public.employee_trainings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  training_date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric(5,2) NOT NULL DEFAULT 0,
  year integer NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
  type text NOT NULL DEFAULT 'internal',
  trainer_name text,
  trainer_id uuid REFERENCES public.employees(id),
  location text,
  certificate_url text,
  signed_file_url text,
  status text NOT NULL DEFAULT 'registered',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all trainings
CREATE POLICY "Admins can manage trainings"
ON public.employee_trainings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Users can view their own trainings
CREATE POLICY "Users can view own trainings"
ON public.employee_trainings
FOR SELECT
TO authenticated
USING (public.can_access_employee(auth.uid(), employee_id));

-- Update trigger
CREATE TRIGGER update_employee_trainings_updated_at
BEFORE UPDATE ON public.employee_trainings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for signed training documents
INSERT INTO storage.buckets (id, name, public) VALUES ('trainings', 'trainings', true);

-- Storage policies
CREATE POLICY "Admins can upload training files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trainings' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update training files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'trainings' AND public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view training files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'trainings');

CREATE POLICY "Admins can delete training files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'trainings' AND public.is_admin(auth.uid()));
