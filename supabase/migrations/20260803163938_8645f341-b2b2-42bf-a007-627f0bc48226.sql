CREATE TABLE IF NOT EXISTS public.time_bank_auto_closure_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year int NOT NULL,
  period_month int NOT NULL,
  closed_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.time_bank_auto_closure_logs TO authenticated;
GRANT ALL ON public.time_bank_auto_closure_logs TO service_role;

ALTER TABLE public.time_bank_auto_closure_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view auto closure logs" ON public.time_bank_auto_closure_logs;
CREATE POLICY "Admins can view auto closure logs"
ON public.time_bank_auto_closure_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.cron_close_all_months(_year int, _month int, _triggered_by text DEFAULT 'cron')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin uuid;
  _emp record;
  _ok int := 0;
  _skipped int := 0;
  _failed int := 0;
  _errors jsonb := '[]'::jsonb;
BEGIN
  IF _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Mês inválido: %', _month;
  END IF;

  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' ORDER BY id LIMIT 1;
  IF _admin IS NULL THEN
    RAISE EXCEPTION 'Nenhum administrador encontrado para executar o fecho automático';
  END IF;

  -- Impersona o administrador para que close_time_bank_month (que valida auth.uid())
  -- possa correr a partir do cron. Local à transação.
  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);

  FOR _emp IN
    SELECT id, first_name, last_name
    FROM public.employees
    WHERE status = 'active'
    ORDER BY first_name, last_name
  LOOP
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.time_bank_monthly_closures
        WHERE employee_id = _emp.id
          AND period_year = _year
          AND period_month = _month
          AND is_locked
      ) THEN
        _skipped := _skipped + 1;
        CONTINUE;
      END IF;

      PERFORM public.close_time_bank_month(
        _emp.id, _year, _month, 'carry_over_all', 0,
        'Fecho automático mensal', 0, true
      );
      _ok := _ok + 1;
    EXCEPTION WHEN OTHERS THEN
      _failed := _failed + 1;
      _errors := _errors || jsonb_build_object(
        'employee_id', _emp.id,
        'name', btrim(coalesce(_emp.first_name,'') || ' ' || coalesce(_emp.last_name,'')),
        'error', SQLERRM
      );
    END;
  END LOOP;

  INSERT INTO public.time_bank_auto_closure_logs
    (period_year, period_month, closed_count, skipped_count, failed_count, errors, triggered_by)
  VALUES (_year, _month, _ok, _skipped, _failed, _errors, coalesce(_triggered_by,'cron'));

  RETURN jsonb_build_object(
    'period_year', _year,
    'period_month', _month,
    'closed', _ok,
    'skipped', _skipped,
    'failed', _failed,
    'errors', _errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_close_all_months(int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_close_all_months(int, int, text) TO service_role;

CREATE OR REPLACE FUNCTION public.cron_close_month_if_last_day()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _local timestamp := (now() AT TIME ZONE 'Europe/Lisbon');
  _today date := _local::date;
BEGIN
  -- Só corre no último dia do mês, às 23h hora de Lisboa.
  IF _today <> (date_trunc('month', _today)::date + interval '1 month' - interval '1 day')::date THEN
    RETURN;
  END IF;
  IF extract(hour FROM _local)::int <> 23 THEN
    RETURN;
  END IF;

  PERFORM public.cron_close_all_months(
    extract(year FROM _today)::int,
    extract(month FROM _today)::int,
    'cron'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_close_month_if_last_day() FROM PUBLIC;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('time-bank-auto-monthly-closure')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'time-bank-auto-monthly-closure');

SELECT cron.schedule(
  'time-bank-auto-monthly-closure',
  '30 22,23 28,29,30,31 * *',
  $$SELECT public.cron_close_month_if_last_day();$$
);