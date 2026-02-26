ALTER TABLE public.vacation_requests DROP CONSTRAINT vacation_requests_status_check;

ALTER TABLE public.vacation_requests ADD CONSTRAINT vacation_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'employee_suggested'::text]));