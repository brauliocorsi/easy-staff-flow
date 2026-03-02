
-- Add days_count column to absences table (1 = full day, 0.5 = half day)
ALTER TABLE public.absences ADD COLUMN days_count numeric NOT NULL DEFAULT 1;
