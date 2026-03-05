ALTER TABLE public.meeting_agendas 
ADD COLUMN responsible_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL DEFAULT NULL;