
-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Admins can manage all document files
CREATE POLICY "Admins can manage document files"
ON storage.objects FOR ALL
USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));

-- Users can view their own document files
CREATE POLICY "Users can view accessible document files"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND public.can_access_employee(auth.uid(), (storage.foldername(name))[1]::uuid));
