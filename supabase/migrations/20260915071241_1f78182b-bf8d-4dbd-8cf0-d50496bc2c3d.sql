REVOKE ALL ON FUNCTION public.enforce_audited_punch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_closed_period() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_anonymous_suggestion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;