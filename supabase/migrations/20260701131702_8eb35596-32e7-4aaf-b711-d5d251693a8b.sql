ALTER TABLE public.overtime_approvals
  ADD CONSTRAINT overtime_approvals_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;