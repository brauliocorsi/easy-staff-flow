
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check
  CHECK (status = ANY (ARRAY['active','inactive','on_leave','vacation','leave','terminated']));
