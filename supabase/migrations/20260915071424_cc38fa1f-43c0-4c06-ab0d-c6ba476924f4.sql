CREATE OR REPLACE FUNCTION public.enforce_audited_punch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só os processos internos (terminal de ponto, picagem automática, manutenção)
  -- escrevem diretamente. Tudo o resto tem de passar pela correção auditada.
  IF current_user IN ('postgres','supabase_admin','service_role') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(current_setting('app.audited_punch', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'As picagens só podem ser alteradas pela correção auditada (com motivo e registo de quem alterou).';
END;
$function$;