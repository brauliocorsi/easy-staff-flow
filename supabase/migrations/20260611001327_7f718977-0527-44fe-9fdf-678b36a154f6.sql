
-- 1. Restrict overly-public SELECT policies to authenticated users
DROP POLICY IF EXISTS "Anyone can view schedules" ON public.employee_schedules;
CREATE POLICY "Authenticated can view schedules" ON public.employee_schedules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view machines" ON public.machines;
CREATE POLICY "Authenticated can view machines" ON public.machines
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view meeting types" ON public.meeting_types;
CREATE POLICY "Authenticated can view meeting types" ON public.meeting_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view schedule templates" ON public.schedule_templates;
CREATE POLICY "Authenticated can view schedule templates" ON public.schedule_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view template days" ON public.schedule_template_days;
CREATE POLICY "Authenticated can view template days" ON public.schedule_template_days
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view alarms" ON public.time_clock_alarms;
CREATE POLICY "Authenticated can view alarms" ON public.time_clock_alarms
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view vacation settings" ON public.vacation_settings;
CREATE POLICY "Authenticated can view vacation settings" ON public.vacation_settings
  FOR SELECT TO authenticated USING (true);

-- 2. Defense in depth on admin_notifications: restrict role to authenticated
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;
CREATE POLICY "Admins can manage notifications" ON public.admin_notifications
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 3. Storage: equipment & trainings -> admin-only SELECT
DROP POLICY IF EXISTS "Authenticated can view equipment files" ON storage.objects;
CREATE POLICY "Admins can view equipment files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'equipment' AND is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view training files" ON storage.objects;
CREATE POLICY "Admins can view training files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'trainings' AND is_admin(auth.uid()));

-- 4. inspection-photos: remove anonymous INSERT and broad SELECT (edge function uses service role; viewing via public URL still works)
DROP POLICY IF EXISTS "Anyone can upload inspection photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read inspection photos" ON storage.objects;
CREATE POLICY "Admins can view inspection photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-photos' AND is_admin(auth.uid()));
