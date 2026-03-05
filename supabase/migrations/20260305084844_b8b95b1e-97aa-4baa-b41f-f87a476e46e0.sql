
CREATE TABLE public.meeting_agenda_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.meeting_agendas(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agenda_id, employee_id)
);

ALTER TABLE public.meeting_agenda_responsibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agenda responsibles" ON public.meeting_agenda_responsibles FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "View agenda responsibles" ON public.meeting_agenda_responsibles FOR SELECT USING (is_admin(auth.uid()));
