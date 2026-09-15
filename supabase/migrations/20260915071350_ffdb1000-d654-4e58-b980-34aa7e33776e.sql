-- can_access_employee nunca deve devolver NULL (NULL não bloqueia num IF NOT).
CREATE OR REPLACE FUNCTION public.can_access_employee(_viewer_id uuid, _employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    public.is_admin(_viewer_id)
    OR COALESCE((SELECT id FROM public.employees WHERE user_id = _viewer_id LIMIT 1) = _employee_id, false)
    OR (
      public.has_role(_viewer_id, 'manager')
      AND EXISTS (
        SELECT 1 FROM public.employees
        WHERE id = _employee_id
        AND manager_id = (SELECT id FROM public.employees WHERE user_id = _viewer_id LIMIT 1)
      )
    ), false)
$function$;

-- O guarda de auditoria tem de ver o papel de quem chama (não o dono da função).
CREATE OR REPLACE FUNCTION public.enforce_audited_punch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role','supabase_auth_admin')
     OR session_user IN ('postgres','supabase_admin','service_role') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(current_setting('app.audited_punch', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'As picagens só podem ser alteradas pela correção auditada (com motivo e registo de quem alterou).';
END;
$function$;