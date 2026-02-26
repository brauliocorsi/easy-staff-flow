
-- Add started_at to track when meeting actually starts (null = not started)
ALTER TABLE public.meetings ADD COLUMN started_at timestamptz;

-- Add present flag to meeting_participants
ALTER TABLE public.meeting_participants ADD COLUMN present boolean NOT NULL DEFAULT false;
