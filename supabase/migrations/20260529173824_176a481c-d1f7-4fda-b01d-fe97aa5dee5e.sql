-- 1. Documents bucket: drop permissive DELETE policy (admin policy already exists)
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- 2. Contracts: restrict SELECT to admins only (salary protection)
DROP POLICY IF EXISTS "Users can view accessible contracts" ON public.contracts;
CREATE POLICY "Admins can view contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Anonymous suggestions: NULL employee_id when is_anonymous=true (prevents admin from identifying)
CREATE OR REPLACE FUNCTION public.enforce_anonymous_suggestion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    NEW.employee_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_anonymous_suggestion_trg ON public.employee_suggestions;
CREATE TRIGGER enforce_anonymous_suggestion_trg
  BEFORE INSERT OR UPDATE ON public.employee_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_anonymous_suggestion();

-- Backfill: scrub identifiers from existing anonymous suggestions
UPDATE public.employee_suggestions
   SET employee_id = NULL
 WHERE is_anonymous = true AND employee_id IS NOT NULL;

-- 4. Make HR buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('documents','equipment','trainings');

-- 5. Drop open public SELECT policies; add authenticated-only SELECT
DROP POLICY IF EXISTS "Public read access for documents" ON storage.objects;
DROP POLICY IF EXISTS "Equipment files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view training files" ON storage.objects;

CREATE POLICY "Authenticated can view equipment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'equipment');

CREATE POLICY "Authenticated can view training files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trainings');

-- documents bucket already has "Users can view accessible document files" (path-scoped) and admin ALL.
