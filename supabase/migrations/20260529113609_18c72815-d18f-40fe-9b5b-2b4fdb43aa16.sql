-- 1) Refine source_type CHECK: remove 'compensatory_rest' (it's a DECISION, not a SOURCE).
ALTER TABLE public.time_bank_movements
  DROP CONSTRAINT IF EXISTS time_bank_movements_source_type_check;

ALTER TABLE public.time_bank_movements
  ADD CONSTRAINT time_bank_movements_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'overtime','day_off_work','holiday_work',
    'manual_adjustment','compensation_used','absence_compensation',
    'payout','correction'
  ]));

-- 2) Transactional RPC to review an overtime_approvals row and create the
--    corresponding time_bank_movements entry atomically.
CREATE OR REPLACE FUNCTION public.review_overtime_approval(
  _approval_id uuid,
  _decision text,
  _notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _approval public.overtime_approvals%ROWTYPE;
  _movement_type text;
  _effective_minutes int;
  _mov_status text;
  _approval_status text;
  _mov_id uuid;
  _requires_reason boolean;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem rever aprovações';
  END IF;

  IF _decision NOT IN ('credit_to_bank','pay_as_overtime','compensatory_rest','offset_negative_balance','reject') THEN
    RAISE EXCEPTION 'Decisão inválida: %', _decision;
  END IF;

  SELECT * INTO _approval FROM public.overtime_approvals WHERE id = _approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aprovação não encontrada';
  END IF;
  IF _approval.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta aprovação já foi decidida (estado: %)', _approval.status;
  END IF;

  -- Motivo obrigatório para decisões que não sejam o crédito simples
  _requires_reason := _decision IN ('reject','pay_as_overtime','compensatory_rest','offset_negative_balance');
  IF _requires_reason AND (_notes IS NULL OR length(btrim(_notes)) = 0) THEN
    RAISE EXCEPTION 'Motivo obrigatório para esta decisão';
  END IF;

  -- Map decision → movement
  IF _decision = 'reject' THEN
    _approval_status := 'rejected';
    _movement_type := 'neutral';
    _effective_minutes := 0;
    _mov_status := 'rejected';
  ELSIF _decision = 'pay_as_overtime' THEN
    _approval_status := 'approved';
    _movement_type := 'neutral';
    _effective_minutes := 0;
    _mov_status := 'paid';
  ELSE
    -- credit_to_bank | compensatory_rest | offset_negative_balance
    _approval_status := 'approved';
    _movement_type := 'credit';
    _effective_minutes := _approval.minutes;
    _mov_status := 'approved';
  END IF;

  UPDATE public.overtime_approvals
     SET status = _approval_status,
         decision = _decision,
         review_notes = _notes,
         reviewed_by = _uid,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = _approval_id;

  INSERT INTO public.time_bank_movements (
    employee_id, record_date, source_type, source_id,
    movement_type, minutes, effective_minutes,
    decision, status, description,
    created_by, approved_by, approved_at
  ) VALUES (
    _approval.employee_id, _approval.record_date, _approval.kind, _approval.id,
    _movement_type, _approval.minutes, _effective_minutes,
    _decision, _mov_status, _notes,
    _uid, _uid, now()
  )
  RETURNING id INTO _mov_id;

  RETURN jsonb_build_object(
    'approval_id', _approval_id,
    'movement_id', _mov_id,
    'approval_status', _approval_status,
    'movement_status', _mov_status,
    'decision', _decision
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_overtime_approval(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_overtime_approval(uuid, text, text) FROM anon;