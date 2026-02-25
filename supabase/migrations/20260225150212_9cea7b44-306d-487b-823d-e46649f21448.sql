
-- Create employee_schedules table
CREATE TABLE public.employee_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  clock_in_time TIME NOT NULL DEFAULT '08:00',
  lunch_out_time TIME NOT NULL DEFAULT '12:00',
  lunch_in_time TIME NOT NULL DEFAULT '13:00',
  clock_out_time TIME NOT NULL DEFAULT '17:00',
  is_day_off BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.employee_schedules ENABLE ROW LEVEL SECURITY;

-- Public read (needed for time clock terminal)
CREATE POLICY "Anyone can view schedules"
ON public.employee_schedules
FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage schedules"
ON public.employee_schedules
FOR ALL
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_employee_schedules_updated_at
BEFORE UPDATE ON public.employee_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
