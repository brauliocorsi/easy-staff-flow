
-- Schedule templates (e.g., "Fábrica", "Loja", "Armazém")
CREATE TABLE public.schedule_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage schedule templates"
  ON public.schedule_templates FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Everyone can view schedule templates"
  ON public.schedule_templates FOR SELECT
  USING (true);

-- Days for each template (7 rows per template)
CREATE TABLE public.schedule_template_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.schedule_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday .. 6=Saturday
  clock_in_time TIME NOT NULL DEFAULT '08:00',
  lunch_out_time TIME NOT NULL DEFAULT '12:00',
  lunch_in_time TIME NOT NULL DEFAULT '13:00',
  clock_out_time TIME NOT NULL DEFAULT '17:00',
  is_day_off BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(template_id, day_of_week)
);

ALTER TABLE public.schedule_template_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template days"
  ON public.schedule_template_days FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Everyone can view template days"
  ON public.schedule_template_days FOR SELECT
  USING (true);

-- Link employees to a schedule template
ALTER TABLE public.employees ADD COLUMN schedule_template_id UUID REFERENCES public.schedule_templates(id) ON DELETE SET NULL;
