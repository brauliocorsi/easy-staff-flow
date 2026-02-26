
-- Table to record early leave attempts
CREATE TABLE public.early_leave_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  attempt_date date NOT NULL DEFAULT CURRENT_DATE,
  attempt_time timestamptz NOT NULL DEFAULT now(),
  scheduled_clock_out time NOT NULL,
  actual_attempt_time time NOT NULL,
  minutes_early integer NOT NULL DEFAULT 0,
  confirmed boolean NOT NULL DEFAULT false,
  seen_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.early_leave_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage early leave attempts"
ON public.early_leave_attempts
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own early leave attempts"
ON public.early_leave_attempts
FOR SELECT
USING (can_access_employee(auth.uid(), employee_id));

-- Notifications table for admin alerts
CREATE TABLE public.admin_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'early_leave',
  reference_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications"
ON public.admin_notifications
FOR ALL
USING (is_admin(auth.uid()));

CREATE INDEX idx_early_leave_attempts_employee ON public.early_leave_attempts(employee_id, attempt_date);
CREATE INDEX idx_admin_notifications_unread ON public.admin_notifications(read, created_at DESC);
