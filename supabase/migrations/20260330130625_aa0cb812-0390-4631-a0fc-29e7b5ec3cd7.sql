-- Add photos column to vehicle_inspections
ALTER TABLE public.vehicle_inspections ADD COLUMN photos text[] DEFAULT '{}';

-- Create storage bucket for inspection photos (public so edge function can return URLs)
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', true);

-- Allow anyone to upload inspection photos
CREATE POLICY "Anyone can upload inspection photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'inspection-photos');

-- Allow anyone to read inspection photos
CREATE POLICY "Anyone can read inspection photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inspection-photos');