
CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  page_url text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can submit bug reports"
ON public.bug_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage bug reports"
ON public.bug_reports FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own bug reports"
ON public.bug_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
