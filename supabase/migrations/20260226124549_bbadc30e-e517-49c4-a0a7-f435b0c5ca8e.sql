
-- Add end_time column to meetings
ALTER TABLE public.meetings ADD COLUMN end_time timestamptz;

-- Enable realtime for meetings, meeting_agendas, meeting_participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_agendas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
