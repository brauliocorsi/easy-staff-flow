
-- Track total paused duration in seconds so countdown can be adjusted
ALTER TABLE public.meetings ADD COLUMN paused_seconds integer NOT NULL DEFAULT 0;
-- Track when the current pause started (null = not paused)
ALTER TABLE public.meetings ADD COLUMN paused_at timestamptz;
