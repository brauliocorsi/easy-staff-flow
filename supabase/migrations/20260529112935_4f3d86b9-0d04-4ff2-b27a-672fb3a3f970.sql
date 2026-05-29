-- Create time_bank_movements table (current-account model for time bank)
CREATE TABLE public.time_bank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  record_date date NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'overtime','day_off_work','holiday_work','manual_adjustment',
    'compensation_used','absence_compensation','payout','correction','compensatory_rest'
  )),
  source_id uuid,
  movement_type text NOT NULL CHECK (movement_type IN ('credit','debit','neutral')),
  minutes integer NOT NULL CHECK (minutes >= 0),
  effective_minutes integer NOT NULL,
  decision text CHECK (decision IN (
    'credit_to_bank','pay_as_overtime','compensatory_rest',
    'offset_negative_balance','reject','use_bank_hours'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid','cancelled')),
  description text,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_bank_movements TO authenticated;
GRANT ALL ON public.time_bank_movements TO service_role;

ALTER TABLE public.time_bank_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage time bank movements"
ON public.time_bank_movements
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users view accessible time bank movements"
ON public.time_bank_movements
FOR SELECT
TO authenticated
USING (public.can_access_employee(auth.uid(), employee_id));

CREATE INDEX idx_tbm_employee_date ON public.time_bank_movements(employee_id, record_date);
CREATE INDEX idx_tbm_status ON public.time_bank_movements(status);
CREATE INDEX idx_tbm_source ON public.time_bank_movements(source_type, source_id);

-- Add decision column to overtime_approvals
ALTER TABLE public.overtime_approvals
  ADD COLUMN IF NOT EXISTS decision text CHECK (decision IN (
    'credit_to_bank','pay_as_overtime','compensatory_rest',
    'offset_negative_balance','reject'
  ));