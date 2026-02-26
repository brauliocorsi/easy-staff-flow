
-- Table for employee suggestions and leadership evaluations
CREATE TABLE public.employee_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'suggestion', -- 'suggestion' or 'leadership_evaluation'
  message TEXT NOT NULL,
  rating INTEGER, -- 1-5 stars for leadership evaluation
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_suggestions ENABLE ROW LEVEL SECURITY;

-- Admins can view all suggestions
CREATE POLICY "Admins can manage suggestions"
ON public.employee_suggestions
FOR ALL
USING (is_admin(auth.uid()));

-- Allow insert via service role (edge function) - no user auth needed
-- The edge function will use service role to insert
