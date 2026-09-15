-- 1) Prontidão do fecho: valida acesso, conta apuramentos em falta/desatualizados,
--    candidatos decididos por rever e limita a compensação ao défice DO PRÓPRIO DIA.
CREATE OR REPLACE FUNCTION public.month_closure_readiness(_employee_id uuid, _year integer, _month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _first date := make_date(_year, _month, 1);
  _last date := (make_date(_year, _month, 1) + interval '1 month' - interval '1 day')::date;
  _pending int; _review int; _missing int; _stale int; _flagged int;
  _deficit int; _compensated int; _debit int;
  _prev_locked boolean; _has_prior boolean; _already boolean;
BEGIN
  IF _uid IS NULL THEN
    IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
      RAISE EXCEPTION 'Sem autorização para consultar a prontidão do fecho';
    END IF;
  ELSIF NOT public.can_access_employee(_uid, _employee_id) THEN
    RAISE EXCEPTION 'Sem autorização para consultar este colaborador';
  END IF;

  SELECT count(*) INTO _pending FROM public.overtime_approvals
   WHERE employee_id = _employee_id AND status = 'pending' AND record_date BETWEEN _first AND _last;

  -- Candidatos já decididos mas sinalizados para revisão humana.
  SELECT count(*) INTO _flagged FROM public.overtime_approvals
   WHERE employee_id = _employee_id AND status <> 'pending' AND needs_review
     AND record_date BETWEEN _first AND _last;

  SELECT count(*) INTO _review FROM public.attendance_daily_evaluations
   WHERE employee_id = _employee_id AND needs_review AND record_date BETWEEN _first AND _last;

  SELECT count(*) INTO _missing FROM public.time_clock_records r
   WHERE r.employee_id = _employee_id AND r.record_date BETWEEN _first AND _last
     AND (r.clock_in IS NOT NULL OR r.lunch_out IS NOT NULL OR r.lunch_in IS NOT NULL OR r.clock_out IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.attendance_daily_evaluations e
                      WHERE e.employee_id = r.employee_id AND e.record_date = r.record_date);

  -- Apuramentos desatualizados: o ponto foi alterado depois do apuramento.
  SELECT count(*) INTO _stale FROM public.time_clock_records r
    JOIN public.attendance_daily_evaluations e
      ON e.employee_id = r.employee_id AND e.record_date = r.record_date
   WHERE r.employee_id = _employee_id AND r.record_date BETWEEN _first AND _last
     AND r.updated_at > e.computed_at;

  SELECT COALESCE(SUM(deficit_minutes), 0) INTO _deficit
    FROM public.attendance_daily_evaluations
   WHERE employee_id = _employee_id AND record_date BETWEEN _first AND _last AND NOT needs_review;

  SELECT COALESCE(SUM(minutes), 0) INTO _compensated
    FROM public.time_bank_movements
   WHERE employee_id = _employee_id AND status IN ('approved','paid')
     AND source_type IN ('compensation_used','absence_compensation')
     AND COALESCE(occurrence_date, record_date) BETWEEN _first AND _last;

  -- Conciliação dia a dia: a compensação de um dia NUNCA abate o défice de outro.
  SELECT COALESCE(SUM(GREATEST(0, e.deficit_minutes - COALESCE(c.comp, 0))), 0)
    INTO _debit
    FROM public.attendance_daily_evaluations e
    LEFT JOIN (
      SELECT COALESCE(occurrence_date, record_date) AS d, SUM(minutes) AS comp
        FROM public.time_bank_movements
       WHERE employee_id = _employee_id AND status IN ('approved','paid')
         AND source_type IN ('compensation_used','absence_compensation')
       GROUP BY 1
    ) c ON c.d = e.record_date
   WHERE e.employee_id = _employee_id AND e.record_date BETWEEN _first AND _last
     AND NOT e.needs_review;

  SELECT EXISTS (SELECT 1 FROM public.time_bank_monthly_closures
                  WHERE employee_id = _employee_id AND is_locked
                    AND make_date(period_year, period_month, 1) = (_first - interval '1 month')::date)
    INTO _prev_locked;

  SELECT EXISTS (SELECT 1 FROM public.time_bank_movements
                  WHERE employee_id = _employee_id AND record_date < _first) INTO _has_prior;

  SELECT EXISTS (SELECT 1 FROM public.time_bank_monthly_closures
                  WHERE employee_id = _employee_id AND period_year = _year
                    AND period_month = _month AND is_locked) INTO _already;

  RETURN jsonb_build_object(
    'pending_candidates', _pending,
    'flagged_candidates', _flagged,
    'review_days', _review,
    'missing_evaluations', _missing,
    'stale_evaluations', _stale,
    'attendance_debit_minutes', _debit,
    'deficit_minutes', _deficit,
    'compensated_minutes', _compensated,
    'month_finished', _last < (now() AT TIME ZONE 'Europe/Lisbon')::date,
    'previous_month_closed', _prev_locked,
    'has_prior_movements', _has_prior,
    'already_closed', _already,
    'ready', _pending = 0 AND _flagged = 0 AND _review = 0 AND _missing = 0 AND _stale = 0
             AND NOT _already
             AND _last < (now() AT TIME ZONE 'Europe/Lisbon')::date
             AND (_prev_locked OR NOT _has_prior)
  );
END;
$function$;

-- 2) Fecho mensal: serializado por colaborador, sem valores negativos e com
--    validação dos apuramentos desatualizados/por rever.
CREATE OR REPLACE FUNCTION public.close_time_bank_month(_employee_id uuid, _year integer, _month integer, _decision text, _paid_minutes integer DEFAULT 0, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF _paid_minutes IS NOT NULL AND _paid_minutes < 0 THEN
    RAISE EXCEPTION 'As horas a pagar não podem ser negativas';
  END IF;

  -- Serialização por colaborador: impede dois fechos/utilizações em simultâneo.
  PERFORM pg_advisory_xact_lock(hashtextextended(_employee_id::text, 42));

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
  IF (_ready->>'flagged_candidates')::int > 0 THEN
    RAISE EXCEPTION 'Existem % decisão(ões) sinalizada(s) para revisão neste mês. Reveja-as antes de fechar.',
      (_ready->>'flagged_candidates')::int;
  END IF;
  IF (_ready->>'review_days')::int > 0 THEN
    RAISE EXCEPTION 'Existem % dia(s) de ponto por validar neste mês. Corrija-os antes de fechar.',
      (_ready->>'review_days')::int;
  END IF;
  IF (_ready->>'missing_evaluations')::int > 0 THEN
    RAISE EXCEPTION 'Faltam % dia(s) por apurar neste mês. Execute o apuramento do ponto antes de fechar.',
      (_ready->>'missing_evaluations')::int;
  END IF;
  IF (_ready->>'stale_evaluations')::int > 0 THEN
    RAISE EXCEPTION 'Existem % dia(s) com apuramento desatualizado (o ponto mudou depois). Volte a apurar antes de fechar.',
      (_ready->>'stale_evaluations')::int;
  END IF;

  -- Débito de conciliação: SEMPRE calculado no servidor, dia a dia.
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
      'Conciliação do ponto no fecho mensal — ' || to_char(_first, 'MM/YYYY') || ' (apurada no servidor, dia a dia)',
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
    IF _paid_on_closure < 0 THEN RAISE EXCEPTION 'As horas a pagar não podem ser negativas'; END IF;
    IF _paid_on_closure > GREATEST(_balance_before, 0) THEN
      RAISE EXCEPTION 'Não é possível pagar mais do que o saldo disponível';
    END IF;
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
$function$;

-- 3) Compatibilidade com a aplicação publicada antiga (7 e 8 argumentos).
--    O débito enviado pelo cliente e a "força" são IGNORADOS: o servidor apura.
CREATE OR REPLACE FUNCTION public.close_time_bank_month(
  _employee_id uuid, _year integer, _month integer, _decision text,
  _paid_minutes integer, _notes text, _attendance_debit_minutes integer)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT public.close_time_bank_month(_employee_id, _year, _month, _decision, _paid_minutes, _notes);
$function$;

CREATE OR REPLACE FUNCTION public.close_time_bank_month(
  _employee_id uuid, _year integer, _month integer, _decision text,
  _paid_minutes integer, _notes text, _attendance_debit_minutes integer, _force boolean)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT public.close_time_bank_month(_employee_id, _year, _month, _decision, _paid_minutes, _notes);
$function$;

REVOKE EXECUTE ON FUNCTION public.close_time_bank_month(uuid,integer,integer,text,integer,text,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_time_bank_month(uuid,integer,integer,text,integer,text,integer,boolean) FROM anon;

-- 4) Utilização de horas: serializada, idempotência validada contra o payload.
CREATE OR REPLACE FUNCTION public.use_time_bank_hours(_employee_id uuid, _occurrence_date date, _minutes integer, _reason text, _source_type text DEFAULT 'compensation_used'::text, _idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _mov public.time_bank_movements%ROWTYPE;
  _mov_id uuid;
  _available int;
  _key text;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem registar utilização de horas';
  END IF;
  IF _source_type NOT IN ('compensation_used','absence_compensation') THEN
    RAISE EXCEPTION 'Tipo de utilização inválido: %', _source_type;
  END IF;
  IF _minutes IS NULL OR _minutes <= 0 THEN
    RAISE EXCEPTION 'Indique uma duração maior que zero';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo obrigatório';
  END IF;
  IF public.is_period_locked(_employee_id, _occurrence_date) THEN
    RAISE EXCEPTION 'O mês de % está fechado. Reabra o mês antes de registar a utilização.',
      to_char(_occurrence_date, 'MM/YYYY');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_employee_id::text, 42));

  _key := COALESCE(_idempotency_key,
    'use:' || _employee_id::text || ':' || _occurrence_date::text || ':' || _minutes::text || ':' || md5(_reason));

  SELECT * INTO _mov FROM public.time_bank_movements
   WHERE idempotency_key = _key AND status <> 'cancelled' LIMIT 1;
  IF FOUND THEN
    IF _mov.employee_id <> _employee_id
       OR COALESCE(_mov.occurrence_date, _mov.record_date) <> _occurrence_date
       OR _mov.minutes <> _minutes
       OR _mov.source_type <> _source_type THEN
      RAISE EXCEPTION 'Referência de operação já usada com dados diferentes. Repita a operação.';
    END IF;
    RETURN jsonb_build_object('movement_id', _mov.id, 'duplicated', true, 'minutes', _minutes);
  END IF;

  SELECT COALESCE(SUM(CASE WHEN status IN ('approved','paid') THEN effective_minutes ELSE 0 END), 0)
    INTO _available
    FROM public.time_bank_movements WHERE employee_id = _employee_id;

  IF _available < _minutes THEN
    RAISE EXCEPTION 'Saldo insuficiente: disponível % minutos, pedido % minutos', _available, _minutes;
  END IF;

  INSERT INTO public.time_bank_movements (
    employee_id, record_date, occurrence_date, source_type, movement_type,
    minutes, effective_minutes, decision, status, description,
    created_by, approved_by, approved_at, idempotency_key
  ) VALUES (
    _employee_id, _occurrence_date, _occurrence_date, _source_type, 'debit',
    _minutes, -_minutes, 'use_bank_hours', 'approved', _reason,
    _uid, _uid, now(), _key
  ) RETURNING id INTO _mov_id;

  RETURN jsonb_build_object('movement_id', _mov_id, 'duplicated', false, 'minutes', _minutes);
END;
$function$;

-- 5) Reabertura serializada pelo mesmo bloqueio.
CREATE OR REPLACE FUNCTION public.reopen_time_bank_month(_closure_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM pg_advisory_xact_lock(hashtextextended(_row.employee_id::text, 42));

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

  UPDATE public.time_bank_movements
     SET status = 'cancelled',
         description = COALESCE(description,'') || ' [cancelado por reabertura]'
   WHERE employee_id = _row.employee_id
     AND source_type = 'monthly_attendance_adjustment'
     AND status <> 'cancelled'
     AND record_date BETWEEN _first AND _last;

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
$function$;

-- 6) Correção de ponto: valida cronologia e marca a operação como auditada.
CREATE OR REPLACE FUNCTION public.correct_time_clock_record(_employee_id uuid, _record_date date, _clock_in timestamp with time zone, _lunch_out timestamp with time zone, _lunch_in timestamp with time zone, _clock_out timestamp with time zone, _reason text, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _old public.time_clock_records%ROWTYPE;
  _rec_id uuid;
  _fields text[] := ARRAY['clock_in','lunch_out','lunch_in','clock_out'];
  _f text;
  _prev timestamptz;
  _new timestamptz;
  _seq timestamptz[];
  _i int;
  _changes int := 0;
  _pending_cleared int := 0;
  _decided_flagged int := 0;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem corrigir picagens';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo obrigatório para corrigir o ponto';
  END IF;
  IF public.is_period_locked(_employee_id, _record_date) THEN
    RAISE EXCEPTION 'O mês de % está fechado. Reabra o mês antes de corrigir.', to_char(_record_date, 'MM/YYYY');
  END IF;

  -- Cronologia: as horas indicadas têm de ser crescentes e do próprio dia.
  _seq := ARRAY(SELECT x FROM unnest(ARRAY[_clock_in,_lunch_out,_lunch_in,_clock_out]) AS x WHERE x IS NOT NULL);
  FOR _i IN 2..GREATEST(array_length(_seq,1), 1) LOOP
    IF array_length(_seq,1) >= _i AND _seq[_i] <= _seq[_i-1] THEN
      RAISE EXCEPTION 'As horas indicadas têm de estar por ordem crescente';
    END IF;
  END LOOP;
  IF array_length(_seq,1) >= 1 THEN
    IF (_seq[1] AT TIME ZONE 'Europe/Lisbon')::date < _record_date - 1
       OR (_seq[array_length(_seq,1)] AT TIME ZONE 'Europe/Lisbon')::date > _record_date + 1 THEN
      RAISE EXCEPTION 'As horas indicadas não pertencem ao dia %', to_char(_record_date,'DD/MM/YYYY');
    END IF;
  END IF;

  PERFORM set_config('app.audited_punch', 'on', true);

  SELECT * INTO _old FROM public.time_clock_records
   WHERE employee_id = _employee_id AND record_date = _record_date FOR UPDATE;

  IF FOUND THEN
    _rec_id := _old.id;
    UPDATE public.time_clock_records
       SET clock_in = _clock_in, lunch_out = _lunch_out,
           lunch_in = _lunch_in, clock_out = _clock_out,
           notes = COALESCE(_notes, notes),
           punch_origin = 'correction'
     WHERE id = _rec_id;
  ELSE
    INSERT INTO public.time_clock_records
      (employee_id, record_date, clock_in, lunch_out, lunch_in, clock_out, notes, punch_origin)
    VALUES (_employee_id, _record_date, _clock_in, _lunch_out, _lunch_in, _clock_out, _notes, 'correction')
    RETURNING id INTO _rec_id;
  END IF;

  FOREACH _f IN ARRAY _fields LOOP
    _prev := CASE _f WHEN 'clock_in' THEN _old.clock_in WHEN 'lunch_out' THEN _old.lunch_out
                     WHEN 'lunch_in' THEN _old.lunch_in ELSE _old.clock_out END;
    _new  := CASE _f WHEN 'clock_in' THEN _clock_in WHEN 'lunch_out' THEN _lunch_out
                     WHEN 'lunch_in' THEN _lunch_in ELSE _clock_out END;
    IF _prev IS DISTINCT FROM _new THEN
      _changes := _changes + 1;
      INSERT INTO public.time_adjustment_logs
        (time_clock_record_id, employee_id, record_date, field, adjustment_type,
         previous_value, new_value, reason, requested_by, approved_by, status)
      VALUES (_rec_id, _employee_id, _record_date, _f,
        CASE WHEN _prev IS NULL THEN 'add' WHEN _new IS NULL THEN 'remove' ELSE 'edit' END,
        _prev, _new, _reason, _uid, _uid, 'approved');
    END IF;
  END LOOP;

  DELETE FROM public.overtime_approvals
   WHERE employee_id = _employee_id AND record_date = _record_date AND status = 'pending';
  GET DIAGNOSTICS _pending_cleared = ROW_COUNT;

  UPDATE public.overtime_approvals
     SET needs_review = true,
         review_notes = COALESCE(review_notes, '') || ' [ponto corrigido em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ' — rever]'
   WHERE employee_id = _employee_id AND record_date = _record_date AND status <> 'pending';
  GET DIAGNOSTICS _decided_flagged = ROW_COUNT;

  DELETE FROM public.attendance_daily_evaluations
   WHERE employee_id = _employee_id AND record_date = _record_date;

  PERFORM set_config('app.audited_punch', 'off', true);

  RETURN jsonb_build_object(
    'record_id', _rec_id, 'changes', _changes,
    'pending_candidates_cleared', _pending_cleared,
    'decided_candidates_flagged', _decided_flagged
  );
END;
$function$;

-- 7) Nenhuma escrita direta de ponto pode contornar a auditoria.
CREATE OR REPLACE FUNCTION public.enforce_audited_punch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role','supabase_auth_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(current_setting('app.audited_punch', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'As picagens só podem ser alteradas pela correção auditada (com motivo e registo de quem alterou).';
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_audited_punch ON public.time_clock_records;
CREATE TRIGGER trg_enforce_audited_punch
  BEFORE INSERT OR UPDATE OR DELETE ON public.time_clock_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audited_punch();