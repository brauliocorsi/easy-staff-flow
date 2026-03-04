-- Drop unique constraint to allow multiple periods per year/category
ALTER TABLE public.vacation_settings DROP CONSTRAINT vacation_settings_year_category_unique;

-- Add a label column to identify each period
ALTER TABLE public.vacation_settings ADD COLUMN label text;