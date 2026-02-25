
-- =============================================
-- 1. ENUM E TABELA DE ROLES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. TABELA DE DEPARTAMENTOS
-- =============================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. TABELA DE FUNCIONÁRIOS
-- =============================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf TEXT UNIQUE,
  birth_date DATE,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  position TEXT NOT NULL DEFAULT 'Não definido',
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'vacation', 'leave', 'terminated')),
  avatar_url TEXT,
  pin_code TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. TABELA DE PROFILES (dados extras do user)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. DOCUMENTOS
-- =============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('rg', 'cpf', 'ctps', 'certificate', 'contract', 'addendum', 'other')),
  file_url TEXT,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. CONTRATOS
-- =============================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'clt' CHECK (type IN ('clt', 'pj', 'temporary', 'intern')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  salary DECIMAL(12,2),
  file_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. REGISTROS DE PONTO
-- =============================================
CREATE TABLE public.time_clock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  lunch_out TIMESTAMPTZ,
  lunch_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, record_date)
);

ALTER TABLE public.time_clock_records ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. ADVERTÊNCIAS
-- =============================================
CREATE TABLE public.warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES public.employees(id),
  type TEXT NOT NULL DEFAULT 'verbal' CHECK (type IN ('verbal', 'written', 'suspension')),
  reason TEXT NOT NULL,
  description TEXT,
  warning_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 9. FÉRIAS
-- =============================================
CREATE TABLE public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES public.employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 10. FALTAS
-- =============================================
CREATE TABLE public.absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'unexcused' CHECK (type IN ('excused', 'unexcused', 'medical')),
  reason TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 11. REUNIÕES
-- =============================================
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES public.employees(id),
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  UNIQUE(meeting_id, employee_id)
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meeting_agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  decision TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 12. FUNÇÕES DE SEGURANÇA (SECURITY DEFINER)
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')
$$;

CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_employee(_viewer_id UUID, _employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_viewer_id)
    OR (SELECT id FROM public.employees WHERE user_id = _viewer_id LIMIT 1) = _employee_id
    OR (
      public.has_role(_viewer_id, 'manager')
      AND EXISTS (
        SELECT 1 FROM public.employees
        WHERE id = _employee_id
        AND manager_id = (SELECT id FROM public.employees WHERE user_id = _viewer_id LIMIT 1)
      )
    )
$$;

-- =============================================
-- 13. RLS POLICIES
-- =============================================

-- user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- departments
CREATE POLICY "Everyone can view departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- employees
CREATE POLICY "Users can view accessible employees" ON public.employees
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), id));

CREATE POLICY "Admins can manage employees" ON public.employees
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- documents
CREATE POLICY "Users can view accessible docs" ON public.documents
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), employee_id));

CREATE POLICY "Admins can manage docs" ON public.documents
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- contracts
CREATE POLICY "Users can view accessible contracts" ON public.contracts
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), employee_id));

CREATE POLICY "Admins can manage contracts" ON public.contracts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- time_clock_records
CREATE POLICY "Users can view accessible time records" ON public.time_clock_records
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), employee_id));

CREATE POLICY "Employees can insert own time records" ON public.time_clock_records
  FOR INSERT TO authenticated WITH CHECK (
    public.get_employee_id_for_user(auth.uid()) = employee_id
  );

CREATE POLICY "Employees can update own time records" ON public.time_clock_records
  FOR UPDATE TO authenticated USING (
    public.get_employee_id_for_user(auth.uid()) = employee_id
  );

CREATE POLICY "Admins can manage time records" ON public.time_clock_records
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- warnings
CREATE POLICY "Users can view accessible warnings" ON public.warnings
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), employee_id));

CREATE POLICY "Managers/Admins can create warnings" ON public.warnings
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Admins can manage warnings" ON public.warnings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- vacation_requests
CREATE POLICY "Users can view accessible vacations" ON public.vacation_requests
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), employee_id));

CREATE POLICY "Employees can request vacation" ON public.vacation_requests
  FOR INSERT TO authenticated WITH CHECK (
    public.get_employee_id_for_user(auth.uid()) = employee_id
  );

CREATE POLICY "Managers can approve vacations" ON public.vacation_requests
  FOR UPDATE TO authenticated USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Admins can manage vacations" ON public.vacation_requests
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- absences
CREATE POLICY "Users can view accessible absences" ON public.absences
  FOR SELECT TO authenticated USING (public.can_access_employee(auth.uid(), employee_id));

CREATE POLICY "Admins can manage absences" ON public.absences
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- meetings
CREATE POLICY "Participants can view meetings" ON public.meetings
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    OR created_by = public.get_employee_id_for_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = id
      AND mp.employee_id = public.get_employee_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Managers/Admins can create meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Admins can manage meetings" ON public.meetings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- meeting_participants
CREATE POLICY "View meeting participants" ON public.meeting_participants
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    OR employee_id = public.get_employee_id_for_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id
      AND m.created_by = public.get_employee_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Admins can manage meeting participants" ON public.meeting_participants
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- meeting_agendas
CREATE POLICY "View meeting agendas" ON public.meeting_agendas
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_agendas.meeting_id
      AND mp.employee_id = public.get_employee_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Admins can manage agendas" ON public.meeting_agendas
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- =============================================
-- 14. TRIGGERS PARA UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_time_clock_records_updated_at BEFORE UPDATE ON public.time_clock_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON public.vacation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 15. TRIGGER PARA CRIAR PROFILE AUTOMATICAMENTE
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
