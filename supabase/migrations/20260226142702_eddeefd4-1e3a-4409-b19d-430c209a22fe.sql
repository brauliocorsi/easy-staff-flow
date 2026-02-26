
-- Add justification deadline and auto-detection fields to absences
ALTER TABLE public.absences 
  ADD COLUMN IF NOT EXISTS justification_deadline date,
  ADD COLUMN IF NOT EXISTS auto_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justification_date timestamptz;

-- Update type default to 'unjustified' for clarity
ALTER TABLE public.absences ALTER COLUMN type SET DEFAULT 'unjustified';

-- Insert policy: allow employees to update their own absences (for justification only)
CREATE POLICY "Employees can justify own absences"
ON public.absences
FOR UPDATE
USING (
  can_access_employee(auth.uid(), employee_id)
  AND auto_detected = true
  AND justified = false
  AND justification_deadline >= CURRENT_DATE
);
