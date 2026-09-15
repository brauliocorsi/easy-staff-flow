-- =====================================================================
-- FASE 3 (cont.) — Fecho consolidado, reabertura em cadeia, cron sem forçar
-- =====================================================================

REVOKE ALL ON FUNCTION public.is_period_locked(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_period_locked(uuid, date) TO authenticated, service_role;

-- 1. Uma única implementação de fecho. Sem parâmetro de "forçar".
DROP FUNCTION IF EXISTS public.close_time_bank_month(uuid,integer,integer,text,integer,text,integer);
DROP FUNCTION IF EXISTS public.close_time_bank_month(uuid,integer,integer,text,integer,text,integer,boolean);

CREATE OR REPLACE FUNCTION public.close_time_bank_month(
  _employee_id uuid,
  _year integer,
  _month integer,
  _decision text,
  _paid_minutes integer DEFAULT 0,
  _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _first date; _last date;
  _ready jsonb;
  _opening int := 0;
  _credits int := 0; _debits int := 0; _paid int := 0; _rejected int := 0; _pending int := 0;
  _attendance_debit int := 0;
  _attendance_id uuid := NULL;
  _balance_before int; _paid_on_closure int := 0; _closing int;
  _payout_id uuid := NULL; _closure_id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem fechar o mês';
  END IF;
  IF _decision NOT IN ('carry_over_all','pay_all_and_zero','pay_partial','manual_adjustment') THEN
    RAISE EXCEPTION 'Decisão de fecho inválida: %', _decision;
  END IF;
  IF _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Mês inválido: %', _month;
  END IF;

  _first := make_date(_year, _month, 1);
  _last := (_first + interval '1 month' - interval '1 day')::date;

  _ready := public.month_closure_readiness(_employee_id, _year, _month);

  IF (_ready->>'already_closed')::boolean THEN
    RAISE EXCEPTION 'Mês já fechado para este colaborador';
  END IF;
  IF NOT (_ready->>'month_finished')::boolean THEN
    RAISE EXCEPTION 'O mês ainda não terminou. O fecho só é permitido depois do último dia.';
  END IF;
  IF NOT (_ready->>'previous_month_closed')::boolean AND (_ready->>'has_prior_movements')::boolean THEN
    RAISE EXCEPTION 'O mês anterior ainda não está fechado. Feche o mês anterior antes de fechar este mês.';
  END IF;
  IF (_ready->>'pending_candidates')::int > 0 THEN
    RAISE EXCEPTION 'Existem % candidato(s) de aprovação por decidir neste mês. Decida-os antes de fechar.',
      (_ready->>'pending_candidates')::int;
  END IF;
  IF (_ready->>'review_days')::int > 0 THEN
    RAISE EXCEPTION 'Existem % dia(s) de ponto por validar neste mês. Corrija-os antes de fechar.',
      (_ready->>'review_days')::int;
  END IF;
  IF (_ready->>'missing_evaluations')::int > 0 THEN
    RAISE EXCEPTION 'Faltam % dia(s) por apurar neste mês. Execute o apuramento do ponto antes de fechar.',
      (_ready->>'missing_evaluations')::int;
  END IF;

  -- Débito de conciliação: SEMPRE calculado no servidor.
  _attendance_debit := (_ready->>'attendance_debit_minutes')::int;

  SELECT carried_over_minutes INTO _opening
    FROM public.time_bank_monthly_closures
   WHERE employee_id = _employee_id
     AND make_date(period_year, period_month, 1) = (_first - interval '1 month')::date
   LIMIT 1;
  _opening := COALESCE(_opening, 0);

  IF _attendance_debit > 0 AND NOT EXISTS (
      SELECT 1 FROM public.time_bank_movements
       WHERE employee_id = _employee_id AND source_type = 'monthly_attendance_adjustment'
         AND status <> 'cancelled' AND record_date BETWEEN _first AND _last) THEN
    INSERT INTO public.time_bank_movements (
      employee_id, record_date, occurrence_date, source_type, movement_type,
      minutes, effective_minutes, decision, status, description,
      created_by, approved_by, approved_at
    ) VALUES (
      _employee_id, _last, _last, 'monthly_attendance_adjustment', 'debit',
      _attendance_debit, -_attendance_debit, 'use_bank_hours', 'approved',
      'Conciliação do ponto no fecho mensal — ' || to_char(_first, 'MM/YYYY') || ' (apurada no servidor)',
      _uid, _uid, now()
    ) RETURNING id INTO _attendance_id;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN status='approved' AND movement_type='credit' THEN effective_minutes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='approved' AND movement_type='debit' AND source_type <> 'payout' THEN ABS(effective_minutes) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='paid' AND source_type <> 'payout' THEN minutes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='rejected' THEN minutes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='pending' THEN minutes ELSE 0 END), 0)
  INTO _credits, _debits, _paid, _rejected, _pending
  FROM public.time_bank_movements
  WHERE employee_id = _employee_id AND record_date BETWEEN _first AND _last;

  _balance_before := _opening + _credits - _debits;

  IF _decision = 'pay_all_and_zero' THEN
    IF _balance_before <= 0 THEN RAISE EXCEPTION 'Pagamento total exige saldo positivo'; END IF;
    _paid_on_closure := _balance_before;
  ELSIF _decision = 'pay_partial' THEN
    IF _paid_minutes IS NULL OR _paid_minutes <= 0 THEN RAISE EXCEPTION 'Indica as horas a pagar'; END IF;
    IF _paid_minutes > _balance_before THEN RAISE EXCEPTION 'Não é possível pagar mais do que o saldo disponível'; END IF;
    IF _notes IS NULL OR length(btrim(_notes)) = 0 THEN RAISE EXCEPTION 'Motivo obrigatório para pagamento parcial'; END IF;
    _paid_on_closure := _paid_minutes;
  ELSIF _decision = 'manual_adjustment' THEN
    IF _notes IS NULL OR length(btrim(_notes)) = 0 THEN RAISE EXCEPTION 'Motivo obrigatório para ajuste manual'; END IF;
    _paid_on_closure := COALESCE(_paid_minutes, 0);
    IF _paid_on_closure > _balance_before THEN RAISE EXCEPTION 'Não é possível pagar mais do que o saldo disponível'; END IF;
  END IF;

  _closing := _balance_before - _paid_on_closure;

  IF _paid_on_closure > 0 THEN
    INSERT INTO public.time_bank_movements (
      employee_id, record_date, occurrence_date, source_type, movement_type,
      minutes, effective_minutes, decision, status, description,
      created_by, approved_by, approved_at
    ) VALUES (
      _employee_id, _last, _last, 'payout', 'debit',
      _paid_on_closure, -_paid_on_closure, 'pay_as_overtime', 'paid',
      'Pagamento de horas extras no fecho mensal', _uid, _uid, now()
    ) RETURNING id INTO _payout_id;
  END IF;

  INSERT INTO public.time_bank_monthly_closures (
    employee_id, period_year, period_month,
    opening_balance_minutes, approved_credits_minutes, approved_debits_minutes,
    paid_minutes, rejected_minutes, pending_minutes_at_close,
    balance_before_closure_minutes, paid_on_closure_minutes,
    carried_over_minutes, closing_balance_minutes,
    closure_decision, closure_notes, payout_movement_id,
    closed_by, closed_at, is_locked
  ) VALUES (
    _employee_id, _year, _month, _opening, _credits, _debits,
    _paid, _rejected, _pending, _balance_before, _paid_on_closure,
    _closing, _closing, _decision, _notes, _payout_id, _uid, now(), true
  )
  ON CONFLICT (employee_id, period_year, period_month) DO UPDATE SET
    opening_balance_minutes = EXCLUDED.opening_balance_minutes,
    approved_credits_minutes = EXCLUDED.approved_credits_minutes,
    approved_debits_minutes = EXCLUDED.approved_debits_minutes,
    paid_minutes = EXCLUDED.paid_minutes,
    rejected_minutes = EXCLUDED.rejected_minutes,
    pending_minutes_at_close = EXCLUDED.pending_minutes_at_close,
    balance_before_closure_minutes = EXCLUDED.balance_before_closure_minutes,
    paid_on_closure_minutes = EXCLUDED.paid_on_closure_minutes,
    carried_over_minutes = EXCLUDED.carried_over_minutes,
    closing_balance_minutes = EXCLUDED.closing_balance_minutes,
    closure_decision = EXCLUDED.closure_decision,
    closure_notes = EXCLUDED.closure_notes,
    payout_movement_id = EXCLUDED.payout_movement_id,
    closed_by = EXCLUDED.closed_by, closed_at = EXCLUDED.closed_at,
    is_locked = true, updated_at = now()
  RETURNING id INTO _closure_id;

  RETURN jsonb_build_object(
    'closure_id', _closure_id, 'payout_movement_id', _payout_id,
    'attendance_movement_id', _attendance_id, 'attendance_debit_minutes', _attendance_debit,
    'opening', _opening, 'approved_credits', _credits, 'approved_debits', _debits,
    'balance_before_closure', _balance_before, 'paid_on_closure', _paid_on_closure,
    'carried_over', _closing, 'closing_balance', _closing
  );
END;
$$;
REVOKE ALL ON FUNCTION public.close_time_bank_month(uuid,integer,integer,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_time_bank_month(uuid,integer,integer,text,integer,text) TO authenticated, service_role;

-- 2. Reabertura: em cadeia e sem cancelar pagamentos reais.
CREATE OR REPLACE FUNCTION public.reopen_time_bank_month(_closure_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.time_bank_monthly_closures%ROWTYPE;
  _first date; _last date;
  _later int;
  _payout_kept boolean := false;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem reabrir o mês';
  END IF;

  SELECT * INTO _row FROM public.time_bank_monthly_closures WHERE id = _closure_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fecho não encontrado'; END IF;

  _first := make_date(_row.period_year, _row.period_month, 1);
  _last := (_first + interval '1 month' - interval '1 day')::date;

  SELECT count(*) INTO _later FROM public.time_bank_monthly_closures
   WHERE employee_id = _row.employee_id AND is_locked
     AND make_date(period_year, period_month, 1) > _first;
  IF _later > 0 THEN
    RAISE EXCEPTION 'Existem % mês(es) posterior(es) fechado(s). Reabra primeiro os meses mais recentes.', _later;
  END IF;

  PERFORM set_config('app.bypass_period_lock', 'on', true);

  UPDATE public.time_bank_monthly_closures
     SET is_locked = false, updated_at = now()
   WHERE id = _closure_id;

  -- Conciliação do ponto é gerada pelo sistema: pode ser anulada.
  UPDATE public.time_bank_movements
     SET status = 'cancelled',
         description = COALESCE(description,'') || ' [cancelado por reabertura]'
   WHERE employee_id = _row.employee_id
     AND source_type = 'monthly_attendance_adjustment'
     AND status <> 'cancelled'
     AND record_date BETWEEN _first AND _last;

  -- Pagamentos reais NUNCA são anulados automaticamente.
  IF _row.payout_movement_id IS NOT NULL THEN
    _payout_kept := true;
  END IF;

  PERFORM set_config('app.bypass_period_lock', 'off', true);

  RETURN jsonb_build_object(
    'closure_id', _closure_id, 'reopened', true,
    'payout_movement_id', _row.payout_movement_id,
    'payout_kept', _payout_kept
  );
END;
$$;
REVOKE ALL ON FUNCTION public.reopen_time_bank_month(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_time_bank_month(uuid) TO authenticated, service_role;

-- 3. Agendamento: prepara e sinaliza, nunca fecha à força.
CREATE OR REPLACE FUNCTION public.cron_prepare_month_closure(_year integer, _month integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp record; _r jsonb;
  _ready int := 0; _blocked int := 0; _closed int := 0;
  _issues jsonb := '[]'::jsonb;
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Operação interna: não autorizada';
  END IF;

  FOR _emp IN SELECT id, first_name, last_name FROM public.employees WHERE status = 'active' LOOP
    _r := public.month_closure_readiness(_emp.id, _year, _month);
    IF (_r->>'already_closed')::boolean THEN
      _closed := _closed + 1;
    ELSIF (_r->>'ready')::boolean THEN
      _ready := _ready + 1;
    ELSE
      _blocked := _blocked + 1;
      _issues := _issues || jsonb_build_object(
        'employee_id', _emp.id,
        'name', btrim(coalesce(_emp.first_name,'') || ' ' || coalesce(_emp.last_name,'')),
        'pending_candidates', _r->'pending_candidates',
        'review_days', _r->'review_days',
        'missing_evaluations', _r->'missing_evaluations',
        'previous_month_closed', _r->'previous_month_closed');
    END IF;
  END LOOP;

  INSERT INTO public.time_bank_auto_closure_logs
    (period_year, period_month, closed_count, skipped_count, failed_count, errors, triggered_by)
  VALUES (_year, _month, 0, _closed, _blocked, _issues, 'cron_prepare');

  RETURN jsonb_build_object('period_year', _year, 'period_month', _month,
    'already_closed', _closed, 'ready_to_close', _ready, 'blocked', _blocked, 'issues', _issues);
END;
$$;
REVOKE ALL ON FUNCTION public.cron_prepare_month_closure(integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_prepare_month_closure(integer,integer) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.cron_close_month_if_last_day()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  _prev date;
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Operação interna: não autorizada';
  END IF;
  -- Corre no dia 1, já com o mês anterior terminado. NUNCA fecha: apenas prepara.
  IF EXTRACT(day FROM _today)::int <> 1 THEN RETURN; END IF;
  _prev := (date_trunc('month', _today) - interval '1 month')::date;
  PERFORM public.cron_prepare_month_closure(
    EXTRACT(year FROM _prev)::int, EXTRACT(month FROM _prev)::int);
END;
$$;
REVOKE ALL ON FUNCTION public.cron_close_month_if_last_day() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_close_month_if_last_day() TO postgres, service_role;

-- 4. Fecho em massa deixa de forçar e valida o chamador.
CREATE OR REPLACE FUNCTION public.cron_close_all_months(_year integer, _month integer, _triggered_by text DEFAULT 'cron')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Operação interna: não autorizada';
  END IF;
  -- O fecho automático em massa foi desativado: passa a preparação e sinalização.
  RETURN public.cron_prepare_month_closure(_year, _month);
END;
$$;
REVOKE ALL ON FUNCTION public.cron_close_all_months(integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_close_all_months(integer,integer,text) TO postgres, service_role;