
-- Add tolerance columns to schedule_templates
ALTER TABLE public.schedule_templates
  ADD COLUMN tolerance_late_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN tolerance_overtime_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN tolerance_early_leave_minutes integer NOT NULL DEFAULT 5;
