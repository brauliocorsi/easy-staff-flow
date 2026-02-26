ALTER TABLE public.absences DROP CONSTRAINT absences_type_check;

ALTER TABLE public.absences ADD CONSTRAINT absences_type_check CHECK (type = ANY (ARRAY['excused'::text, 'unexcused'::text, 'medical'::text, 'unjustified'::text, 'justified'::text, 'vacation_swap'::text]));