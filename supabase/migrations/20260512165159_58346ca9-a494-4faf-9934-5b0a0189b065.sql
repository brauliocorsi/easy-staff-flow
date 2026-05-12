ALTER TABLE public.vacation_requests REPLICA IDENTITY FULL;
ALTER TABLE public.absences REPLICA IDENTITY FULL;
ALTER TABLE public.warnings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vacation_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warnings;