
-- Fix infinite recursion in meetings policies
-- Drop the problematic SELECT policy on meetings
DROP POLICY IF EXISTS "Participants can view meetings" ON public.meetings;

-- Recreate without recursive subquery - admins see all, others see their own created meetings
CREATE POLICY "Participants can view meetings"
ON public.meetings
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR created_by = public.get_employee_id_for_user(auth.uid())
);

-- Fix infinite recursion in meeting_participants policies
DROP POLICY IF EXISTS "View meeting participants" ON public.meeting_participants;

-- Recreate without recursive reference back to meetings
CREATE POLICY "View meeting participants"
ON public.meeting_participants
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR employee_id = public.get_employee_id_for_user(auth.uid())
);

-- Also fix meeting_agendas SELECT policy which references meeting_participants
DROP POLICY IF EXISTS "View meeting agendas" ON public.meeting_agendas;

CREATE POLICY "View meeting agendas"
ON public.meeting_agendas
FOR SELECT
USING (
  public.is_admin(auth.uid())
);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
