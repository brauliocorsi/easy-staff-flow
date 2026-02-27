
CREATE TABLE public.time_clock_alarms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  alarm_time time without time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_clock_alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alarms" ON public.time_clock_alarms FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view alarms" ON public.time_clock_alarms FOR SELECT USING (true);
