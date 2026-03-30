
CREATE TABLE public.vehicle_inspections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  km integer NOT NULL DEFAULT 0,
  oil_level text NOT NULL DEFAULT 'ok',
  brake_pads text NOT NULL DEFAULT 'ok',
  brakes text NOT NULL DEFAULT 'ok',
  water_level text NOT NULL DEFAULT 'ok',
  tire_condition text NOT NULL DEFAULT 'ok',
  cleanliness text NOT NULL DEFAULT 'ok',
  scratches text NOT NULL DEFAULT 'none',
  dents text NOT NULL DEFAULT 'none',
  turn_signals text NOT NULL DEFAULT 'ok',
  lights text NOT NULL DEFAULT 'ok',
  material_return text NOT NULL DEFAULT 'ok',
  vest boolean NOT NULL DEFAULT false,
  jack boolean NOT NULL DEFAULT false,
  wheel_wrench boolean NOT NULL DEFAULT false,
  observations text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vehicle_inspections"
  ON public.vehicle_inspections FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own vehicle_inspections"
  ON public.vehicle_inspections FOR SELECT
  TO authenticated
  USING (can_access_employee(auth.uid(), employee_id));
