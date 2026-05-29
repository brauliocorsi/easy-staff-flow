CREATE OR REPLACE FUNCTION public.close_time_bank_month(_employee_id uuid, _year integer, _month integer, _decision text, _paid_minutes integer DEFAULT 0, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _first_day date;
  _last_day date;
  _opening int := 0;
  _credits int := 0;
  _debits int := 0;
  _paid int := 0;
  _rejected int := 0;
  _pending int := 0;
  _balance_before int;
  _paid_on_closure int := 0;
  _closing int;
  _existing public.time_bank_monthly_closures%ROWTYPE;
  _prev_closure_exists boolean := false;
  _has_prior_movements boolean := false;
  _payout_id uuid := NULL;
  _closure_id uuid;
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

  _first_day := make_date(_year, _month, 1);
  _last_day := (_first_day + interval '1 month' - interval '1 day')::date;

  -- Lock existing
  SELECT * INTO _existing FROM public.time_bank_monthly_closures
    WHERE employee_id = _employee_id AND period_year = _year AND period_month = _month
    FOR UPDATE;
  IF FOUND AND _existing.is_locked THEN
    RAISE EXCEPTION 'Mês já fechado para este funcionário';
  END IF;

  -- Opening = carried_over of previous month closure
  SELECT carried_over_minutes INTO _opening
    FROM public.time_bank_monthly_closures
    WHERE employee_id = _employee_id
      AND make_date(period_year, period_month, 1) = (_first_day - interval '1 month')::date
    LIMIT 1;

  _prev_closure_exists := FOUND;
  _opening := COALESCE(_opening, 0);

  -- Bloqueio de segurança: se o mês anterior NÃO está fechado mas existem
  -- movimentos anteriores ao 1º dia deste mês, não é seguro assumir opening = 0.
  IF NOT _prev_closure_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM public.time_bank_movements
      WHERE employee_id = _employee_id
        AND record_date < _first_day
    ) INTO _has_prior_movements;

    IF _has_prior_movements THEN
      RAISE EXCEPTION 'O mês anterior ainda não está fechado. Feche o mês anterior antes de fechar este mês.';
    END IF;
  END IF;

  -- Aggregate movements in month (exclude payouts from closure itself)
  SELECT
    COALESCE(SUM(CASE WHEN status='approved' AND movement_type='credit' THEN effective_minutes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='approved' AND movement_type='debit' AND source_type <> 'payout' THEN ABS(effective_minutes) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='paid' AND source_type <> 'payout' THEN minutes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='rejected' THEN minutes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='pending' AND (decision IS NULL OR decision IN ('credit_to_bank','offset_negative_balance','compensatory_rest')) THEN minutes ELSE 0 END), 0)
  INTO _credits, _debits, _paid, _rejected, _pending
  FROM public.time_bank_movements
  WHERE employee_id = _employee_id
    AND record_date BETWEEN _first_day AND _last_day;

  _balance_before := _opening + _credits - _debits;

  -- Validate decision
  IF _decision = 'pay_all_and_zero' THEN
    IF _balance_before <= 0 THEN
      RAISE EXCEPTION 'Pagamento total exige saldo positivo';
    END IF;
    _paid_on_closure := _balance_before;
  ELSIF _decision = 'pay_partial' THEN
    IF _paid_minutes IS NULL OR _paid_minutes <= 0 THEN
      RAISE EXCEPTION 'Indica as horas a pagar';
    END IF;
    IF _paid_minutes > _balance_before THEN
      RAISE EXCEPTION 'Não é possível pagar mais do que o saldo disponível';
    END IF;
    IF _notes IS NULL OR length(btrim(_notes)) = 0 THEN
      RAISE EXCEPTION 'Motivo obrigatório para pagamento parcial';
    END IF;
    _paid_on_closure := _paid_minutes;
  ELSIF _decision = 'manual_adjustment' THEN
    IF _notes IS NULL OR length(btrim(_notes)) = 0 THEN
      RAISE EXCEPTION 'Motivo obrigatório para ajuste manual';
    END IF;
    _paid_on_closure := COALESCE(_paid_minutes, 0);
    IF _paid_on_closure > _balance_before THEN
      RAISE EXCEPTION 'Não é possível pagar mais do que o saldo disponível';
    END IF;
  ELSE
    _paid_on_closure := 0;
  END IF;

  _closing := _balance_before - _paid_on_closure;

  -- Insert payout movement if needed
  IF _paid_on_closure > 0 THEN
    INSERT INTO public.time_bank_movements (
      employee_id, record_date, source_type, source_id,
      movement_type, minutes, effective_minutes,
      decision, status, description,
      created_by, approved_by, approved_at
    ) VALUES (
      _employee_id, _last_day, 'payout', NULL,
      'debit', _paid_on_closure, -_paid_on_closure,
      'pay_as_overtime', 'paid', 'Pagamento de horas extras no fecho mensal',
      _uid, _uid, now()
    ) RETURNING id INTO _payout_id;
  END IF;

  -- Upsert closure
  INSERT INTO public.time_bank_monthly_closures (
    employee_id, period_year, period_month,
    opening_balance_minutes, approved_credits_minutes, approved_debits_minutes,
    paid_minutes, rejected_minutes, pending_minutes_at_close,
    balance_before_closure_minutes, paid_on_closure_minutes,
    carried_over_minutes, closing_balance_minutes,
    closure_decision, closure_notes, payout_movement_id,
    closed_by, closed_at, is_locked
  ) VALUES (
    _employee_id, _year, _month,
    _opening, _credits, _debits,
    _paid, _rejected, _pending,
    _balance_before, _paid_on_closure,
    _closing, _closing,
    _decision, _notes, _payout_id,
    _uid, now(), true
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
    closed_by = EXCLUDED.closed_by,
    closed_at = EXCLUDED.closed_at,
    is_locked = true,
    updated_at = now()
  RETURNING id INTO _closure_id;

  RETURN jsonb_build_object(
    'closure_id', _closure_id,
    'payout_movement_id', _payout_id,
    'opening', _opening,
    'approved_credits', _credits,
    'approved_debits', _debits,
    'balance_before_closure', _balance_before,
    'paid_on_closure', _paid_on_closure,
    'carried_over', _closing,
    'closing_balance', _closing
  );
END;
$function$;