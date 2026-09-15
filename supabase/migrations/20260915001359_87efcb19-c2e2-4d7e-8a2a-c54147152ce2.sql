-- =====================================================================
-- FASE 2.2 — Parâmetros, origem das picagens, apuramento persistido
--            e fecho das brechas de segurança
-- =====================================================================

-- 1. Tolerância explícita de entrada antecipada (default 0 = mostra todos
--    os minutos brutos como candidato; nunca credita automaticamente).
ALTER TABLE public.schedule_templates
  ADD COLUMN IF NOT EXISTS tolerance_early_entry_minutes integer NOT NULL DEFAULT 0;

-- 2. Origem da picagem e fotografia do horário aplicado (a partir de agora).
ALTER TABLE public.time_clock_records
  ADD COLUMN IF NOT EXISTS punch_origin text,
  ADD COLUMN IF NOT EXISTS schedule_snapshot jsonb;

UPDATE public.time_clock_records SET punch_origin = 'legacy' WHERE punch_origin IS NULL;

ALTER TABLE public.time_clock_records
  ALTER COLUMN punch_origin SET DEFAULT 'manual';

ALTER TABLE public.time_clock_records
  DROP CONSTRAINT IF EXISTS time_clock_records_punch_origin_check;
ALTER TABLE public.time_clock_records
  ADD CONSTRAINT time_clock_records_punch_origin_check
  CHECK (punch_origin IN ('legacy','kiosk','auto','manual','correction'));

-- 3. Referência de ocorrência e idempotência nos movimentos do banco.
ALTER TABLE public.time_bank_movements
  ADD COLUMN IF NOT EXISTS occurrence_date date,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS time_bank_movements_idempotency_key_uidx
  ON public.time_bank_movements (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS time_bank_movements_occurrence_idx
  ON public.time_bank_movements (employee_id, occurrence_date);

-- 4. Novo tipo de candidato: entrada antecipada (nunca creditada automaticamente).
ALTER TABLE public.overtime_approvals DROP CONSTRAINT IF EXISTS overtime_approvals_kind_check;
ALTER TABLE public.overtime_approvals ADD CONSTRAINT overtime_approvals_kind_check
  CHECK (kind IN ('overtime','early_entry','day_off_work','holiday_work','vacation_work'));

ALTER TABLE public.time_bank_movements DROP CONSTRAINT IF EXISTS time_bank_movements_source_type_check;
ALTER TABLE public.time_bank_movements ADD CONSTRAINT time_bank_movements_source_type_check
  CHECK (source_type IN ('overtime','early_entry','day_off_work','holiday_work','vacation_work',
                         'manual_adjustment','compensation_used','absence_compensation','payout',
                         'monthly_attendance_adjustment','opening_balance_snapshot','correction',
                         'manual_zero_adjustment'));

-- 5. Apuramento diário persistido (escrito pelo motor partilhado).
CREATE TABLE IF NOT EXISTS public.attendance_daily_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  scheduled_minutes integer NOT NULL DEFAULT 0,
  worked_minutes integer NOT NULL DEFAULT 0,
  deficit_minutes integer NOT NULL DEFAULT 0,
  overtime_candidate_minutes integer NOT NULL DEFAULT 0,
  early_entry_candidate_minutes integer NOT NULL DEFAULT 0,
  needs_review boolean NOT NULL DEFAULT false,
  review_reasons text[] NOT NULL DEFAULT '{}',
  is_day_off boolean NOT NULL DEFAULT false,
  no_record boolean NOT NULL DEFAULT false,
  engine_version text NOT NULL DEFAULT 'v2',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, record_date)
);

GRANT SELECT ON public.attendance_daily_evaluations TO authenticated;
GRANT ALL ON public.attendance_daily_evaluations TO service_role;
ALTER TABLE public.attendance_daily_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view accessible attendance evaluations" ON public.attendance_daily_evaluations;
CREATE POLICY "Users view accessible attendance evaluations"
  ON public.attendance_daily_evaluations FOR SELECT TO authenticated
  USING (public.can_access_employee(auth.uid(), employee_id));

DROP TRIGGER IF EXISTS trg_ade_updated_at ON public.attendance_daily_evaluations;
CREATE TRIGGER trg_ade_updated_at BEFORE UPDATE ON public.attendance_daily_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Segurança: funções internas deixam de ser executáveis pela API.
REVOKE ALL ON FUNCTION public.cron_close_all_months(integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_close_month_if_last_day() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_close_all_months(integer, integer, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.cron_close_month_if_last_day() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_assign_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_anonymous_suggestion() FROM PUBLIC, anon, authenticated;

-- 7. Picagens: fecha escrita direta do colaborador. O quiosque (PIN) continua
--    a funcionar porque passa pelas edge functions com chave de serviço, e os
--    administradores continuam a poder corrigir via RPC auditada.
DROP POLICY IF EXISTS "Employees can insert own time records" ON public.time_clock_records;
DROP POLICY IF EXISTS "Employees can update own time records" ON public.time_clock_records;