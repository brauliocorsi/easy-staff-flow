
-- Add salary fields to employees (admin-only sensitive data)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS monthly_salary numeric DEFAULT NULL;
