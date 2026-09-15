-- Endurecimento: funções de negócio e ajudantes de RLS deixam de ser
-- executáveis por visitantes não autenticados.
REVOKE ALL ON FUNCTION public.create_opening_balance_snapshot(uuid,date,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_opening_balance_snapshot(uuid,date,integer,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.review_overtime_approval(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_overtime_approval(uuid,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_manager_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_employee(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_employee(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_employee_id_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_id_for_user(uuid) TO authenticated, service_role;