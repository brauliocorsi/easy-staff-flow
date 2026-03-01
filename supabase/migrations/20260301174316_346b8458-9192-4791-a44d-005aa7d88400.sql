
-- =============================================
-- Vehicles table
-- =============================================
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  brand text,
  model text,
  year integer,
  color text,
  vin text,
  fuel_type text DEFAULT 'diesel',
  km_current integer DEFAULT 0,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vehicles"
  ON public.vehicles FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can view vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- Vehicle documents (insurance / inspection)
-- =============================================
CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'insurance',
  description text NOT NULL,
  provider text,
  start_date date NOT NULL,
  expiry_date date NOT NULL,
  cost numeric,
  file_url text,
  reminder_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vehicle_documents"
  ON public.vehicle_documents FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can view vehicle_documents"
  ON public.vehicle_documents FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- Vehicle maintenances
-- =============================================
CREATE TABLE public.vehicle_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'preventive',
  description text NOT NULL,
  maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
  next_maintenance_date date,
  next_maintenance_km integer,
  km_at_maintenance integer,
  cost numeric,
  provider text,
  invoice_url text,
  parts_replaced text,
  performed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vehicle_maintenances"
  ON public.vehicle_maintenances FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can view vehicle_maintenances"
  ON public.vehicle_maintenances FOR SELECT
  TO authenticated
  USING (true);
