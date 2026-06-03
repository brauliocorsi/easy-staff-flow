ALTER TABLE public.absences
ADD COLUMN IF NOT EXISTS admin_confirmed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS confirmed_by uuid;