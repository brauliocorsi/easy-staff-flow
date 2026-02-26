
-- Add new columns to vacation_requests
ALTER TABLE public.vacation_requests
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS year integer NOT NULL DEFAULT extract(year from now())::integer,
  ADD COLUMN IF NOT EXISTS total_entitled_days integer NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS employee_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS enjoyed boolean NOT NULL DEFAULT false;

-- Create unique index on token for public access
CREATE UNIQUE INDEX IF NOT EXISTS vacation_requests_token_idx ON public.vacation_requests(token);

-- Create vacation_settings table for collective vacations
CREATE TABLE IF NOT EXISTS public.vacation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  category text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vacation_settings_category_check CHECK (category IN ('factory', 'warehouse')),
  CONSTRAINT vacation_settings_year_category_unique UNIQUE (year, category)
);

-- Enable RLS on vacation_settings
ALTER TABLE public.vacation_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for vacation_settings
CREATE POLICY "Admins can manage vacation settings"
  ON public.vacation_settings
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Everyone can view vacation settings"
  ON public.vacation_settings
  FOR SELECT
  USING (true);
