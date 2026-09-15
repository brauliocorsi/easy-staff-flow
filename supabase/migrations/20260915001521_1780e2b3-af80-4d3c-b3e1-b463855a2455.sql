-- =====================================================================
-- FASE 3 — Cadeia de correção, utilização de horas e fecho consolidado
-- =====================================================================

ALTER TABLE public.overtime_approvals
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 1. Bloqueio de alterações em mês fechado
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_period_locked(_employee_id uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.time_bank_monthly_closures
    WHERE employee_id = _employee_id
      AND period_year = EXTRACT(year FROM _date)::int
      AND period_month = EXTRACT(month FROM _date)::int
      AND is_locked
  )
$$;

CREATE OR REPLACE FUNCTION public.guard_closed_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp uuid;
  _date date;
BEGIN
  IF COALESCE(current_setting('app.bypass_period_lock', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _emp := OLD.employee_id; _date := OLD.record_date;
  ELSE
    _emp := NEW.employee_id; _date := NEW.record_date;
  END IF;

  IF public.is_period_locked(_emp, _date) THEN
    RAISE EXCEPTION 'O mês de % está fechado para este colaborador. Reabra o mês antes de alterar %.',
      to_char(_date, 'MM/YYYY'), TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.record_date <> NEW.record_date
     AND public.is_period_locked(_emp, OLD.record_date) THEN
    RAISE EXCEPTION 'O mês de origem (%) está fechado.', to_char(OLD.record_date, 'MM/YYYY');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.guard_closed_period() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_closed_period ON public.time_clock_records;
CREATE TRIGGER trg_guard_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.time_clock_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_period();

DROP TRIGGER IF EXISTS trg_guard_closed_period ON public.overtime_approvals;
CREATE TRIGGER trg_guard_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.overtime_approvals
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_period();

DROP TRIGGER IF EXISTS trg_guard_closed_period ON public.time_bank_movements;
CREATE TRIGGER trg_guard_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.time_bank_movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_period();

-- ---------------------------------------------------------------------
-- 2. RPC transacional de correção de ponto (motivo obrigatório + auditoria)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.correct_time_clock_record(
  _employee_id uuid,
  _record_date date,
  _clock_in timestamptz,
  _lunch_out timestamptz,
  _lunch_in timestamptz,
  _clock_out timestamptz,
  _reason text,
  _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _old public.time_clock_records%ROWTYPE;
  _rec_id uuid;
  _fields text[] := ARRAY['clock_in','lunch_out','lunch_in','clock_out'];
  _f text;
  _prev timestamptz;
  _new timestamptz;
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

  -- Candidatos pendentes deste dia deixam de ser válidos: são removidos para
  -- voltarem a ser apurados pelo motor. Decisões tomadas são preservadas e
  -- apenas sinalizadas para revisão humana.
  DELETE FROM public.overtime_approvals
   WHERE employee_id = _employee_id AND record_date = _record_date AND status = 'pending';
  GET DIAGNOSTICS _pending_cleared = ROW_COUNT;

  UPDATE public.overtime_approvals
     SET needs_review = true,
         review_notes = COALESCE(review_notes, '') || ' [ponto corrigido em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ' — rever]'
   WHERE employee_id = _employee_id AND record_date = _record_date AND status <> 'pending';
  GET DIAGNOSTICS _decided_flagged = ROW_COUNT;

  -- Apuramento do dia fica obsoleto: é removido para ser recalculado.
  DELETE FROM public.attendance_daily_evaluations
   WHERE employee_id = _employee_id AND record_date = _record_date;

  RETURN jsonb_build_object(
    'record_id', _rec_id, 'changes', _changes,
    'pending_candidates_cleared', _pending_cleared,
    'decided_candidates_flagged', _decided_flagged
  );
END;
$$;
REVOKE ALL ON FUNCTION public.correct_time_clock_record(uuid,date,timestamptz,timestamptz,timestamptz,timestamptz,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_time_clock_record(uuid,date,timestamptz,timestamptz,timestamptz,timestamptz,text,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Utilização de horas do banco (idempotente, referencia a ocorrência)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_time_bank_hours(
  _employee_id uuid,
  _occurrence_date date,
  _minutes integer,
  _reason text,
  _source_type text DEFAULT 'compensation_used',
  _idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
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

  _key := COALESCE(_idempotency_key,
    'use:' || _employee_id::text || ':' || _occurrence_date::text || ':' || _minutes::text || ':' || md5(_reason));

  SELECT id INTO _mov_id FROM public.time_bank_movements
   WHERE idempotency_key = _key AND status <> 'cancelled' LIMIT 1;
  IF _mov_id IS NOT NULL THEN
    RETURN jsonb_build_object('movement_id', _mov_id, 'duplicated', true, 'minutes', _minutes);
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
$$;
REVOKE ALL ON FUNCTION public.use_time_bank_hours(uuid,date,integer,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_time_bank_hours(uuid,date,integer,text,text,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Apuramento mensal servidor (fonte única do débito de conciliação)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.month_closure_readiness(_employee_id uuid, _year integer, _month integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _first date := make_date(_year, _month, 1);
  _last date := (make_date(_year, _month, 1) + interval '1 month' - interval '1 day')::date;
  _pending int; _review int; _missing int; _deficit int; _compensated int;
  _prev_locked boolean; _has_prior boolean; _already boolean;
BEGIN
  SELECT count(*) INTO _pending FROM public.overtime_approvals
   WHERE employee_id = _employee_id AND status = 'pending' AND record_date BETWEEN _first AND _last;

  SELECT count(*) INTO _review FROM public.attendance_daily_evaluations
   WHERE employee_id = _employee_id AND needs_review AND record_date BETWEEN _first AND _last;

  SELECT count(*) INTO _missing FROM public.time_clock_records r
   WHERE r.employee_id = _employee_id AND r.record_date BETWEEN _first AND _last
     AND (r.clock_in IS NOT NULL OR r.lunch_out IS NOT NULL OR r.lunch_in IS NOT NULL OR r.clock_out IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.attendance_daily_evaluations e
                      WHERE e.employee_id = r.employee_id AND e.record_date = r.record_date);

  SELECT COALESCE(SUM(deficit_minutes), 0) INTO _deficit FROM public.attendance_daily_evaluations
   WHERE employee_id = _employee_id AND record_date BETWEEN _first AND _last AND NOT needs_review;

  SELECT COALESCE(SUM(minutes), 0) INTO _compensated FROM public.time_bank_movements
   WHERE employee_id = _employee_id AND status IN ('approved','paid')
     AND source_type IN ('compensation_used','absence_compensation')
     AND COALESCE(occurrence_date, record_date) BETWEEN _first AND _last;

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
    'review_days', _review,
    'missing_evaluations', _missing,
    'attendance_debit_minutes', GREATEST(0, _deficit - _compensated),
    'deficit_minutes', _deficit,
    'compensated_minutes', _compensated,
    'month_finished', _last < (now() AT TIME ZONE 'Europe/Lisbon')::date,
    'previous_month_closed', _prev_locked,
    'has_prior_movements', _has_prior,
    'already_closed', _already,
    'ready', _pending = 0 AND _review = 0 AND _missing = 0 AND NOT _already
             AND _last < (now() AT TIME ZONE 'Europe/Lisbon')::date
             AND (_prev_locked OR NOT _has_prior)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.month_closure_readiness(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.month_closure_readiness(uuid,integer,integer) TO authenticated, service_role;