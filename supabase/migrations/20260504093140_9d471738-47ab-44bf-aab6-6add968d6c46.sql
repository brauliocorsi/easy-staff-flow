CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  recurring_yearly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(holiday_date)
);

CREATE INDEX idx_holidays_date ON public.holidays(holiday_date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone authenticated can view holidays"
ON public.holidays FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage holidays"
ON public.holidays FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed feriados nacionais portugueses fixos (recorrentes anualmente)
INSERT INTO public.holidays (holiday_date, name, recurring_yearly) VALUES
  ('2026-01-01', 'Ano Novo', true),
  ('2026-04-25', 'Dia da Liberdade', true),
  ('2026-05-01', 'Dia do Trabalhador', true),
  ('2026-06-10', 'Dia de Portugal', true),
  ('2026-08-15', 'Assunção de Nossa Senhora', true),
  ('2026-10-05', 'Implantação da República', true),
  ('2026-11-01', 'Todos os Santos', true),
  ('2026-12-01', 'Restauração da Independência', true),
  ('2026-12-08', 'Imaculada Conceição', true),
  ('2026-12-25', 'Natal', true)
ON CONFLICT (holiday_date) DO NOTHING;