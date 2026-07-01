
ALTER TABLE public.overtime_approvals DROP CONSTRAINT IF EXISTS overtime_approvals_kind_check;
ALTER TABLE public.overtime_approvals ADD CONSTRAINT overtime_approvals_kind_check
  CHECK (kind = ANY (ARRAY['overtime'::text, 'day_off_work'::text, 'holiday_work'::text, 'vacation_work'::text]));

ALTER TABLE public.time_bank_movements DROP CONSTRAINT IF EXISTS time_bank_movements_source_type_check;
ALTER TABLE public.time_bank_movements ADD CONSTRAINT time_bank_movements_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'overtime'::text, 'day_off_work'::text, 'holiday_work'::text, 'vacation_work'::text,
    'manual_adjustment'::text, 'compensation_used'::text, 'absence_compensation'::text,
    'payout'::text, 'monthly_attendance_adjustment'::text, 'opening_balance_snapshot'::text,
    'correction'::text, 'manual_zero_adjustment'::text
  ]));
