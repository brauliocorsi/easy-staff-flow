
-- Dynamic meeting types table
CREATE TABLE public.meeting_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage meeting types" ON public.meeting_types FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Everyone can view meeting types" ON public.meeting_types FOR SELECT USING (true);

-- Seed common types
INSERT INTO public.meeting_types (name) VALUES
  ('Reunião de Alinhamento'),
  ('Reunião de Cobrança de Resultado'),
  ('Reunião de Planejamento'),
  ('Reunião de Feedback');

-- Add meeting_type and scheduled_time to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_type text;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS scheduled_time time without time zone;
