-- Phase 2: Overtime approvals + manual adjustment audit log

CREATE TABLE public.overtime_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  record_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('overtime', 'day_off_work', 'holiday_work')),
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  tolerance_applied_minutes INTEGER NOT NULL DEFAULT 0,
  scheduled_clock_out TIME,
  actual_clock_in TIMESTAMPTZ,
  actual_clock_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  time_clock_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, record_date, kind)
);

CREATE INDEX idx_overtime_approvals_employee_date ON public.overtime_approvals (employee_id, record_date);
CREATE INDEX idx_overtime_approvals_status ON public.overtime_approvals (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_approvals TO authenticated;
GRANT ALL ON public.overtime_approvals TO service_role;

ALTER TABLE public.overtime_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage overtime approvals"
ON public.overtime_approvals FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view accessible overtime approvals"
ON public.overtime_approvals FOR SELECT TO authenticated
USING (public.can_access_employee(auth.uid(), employee_id));

CREATE TRIGGER update_overtime_approvals_updated_at
BEFORE UPDATE ON public.overtime_approvals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Immutable audit of manual adjustments to time_clock_records
CREATE TABLE public.time_adjustment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_clock_record_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  record_date DATE NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('clock_in', 'lunch_out', 'lunch_in', 'clock_out')),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'edit', 'remove')),
  previous_value TIMESTAMPTZ,
  new_value TIMESTAMPTZ,
  reason TEXT NOT NULL,
  requested_by UUID,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_adjustment_logs_record ON public.time_adjustment_logs (time_clock_record_id);
CREATE INDEX idx_time_adjustment_logs_employee_date ON public.time_adjustment_logs (employee_id, record_date);

GRANT SELECT, INSERT ON public.time_adjustment_logs TO authenticated;
GRANT ALL ON public.time_adjustment_logs TO service_role;

ALTER TABLE public.time_adjustment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert adjustment logs"
ON public.time_adjustment_logs FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all adjustment logs"
ON public.time_adjustment_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own adjustment logs"
ON public.time_adjustment_logs FOR SELECT TO authenticated
USING (public.can_access_employee(auth.uid(), employee_id));