-- =====================================================================
-- FASE 2.1 — Cópia de segurança privada antes de qualquer alteração
-- Schema privado, NÃO exposto à API, sem PIN nem credenciais.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS backup_20260915;

REVOKE ALL ON SCHEMA backup_20260915 FROM PUBLIC;
REVOKE ALL ON SCHEMA backup_20260915 FROM anon, authenticated;
GRANT USAGE ON SCHEMA backup_20260915 TO service_role;

CREATE TABLE IF NOT EXISTS backup_20260915.time_clock_records AS
  SELECT * FROM public.time_clock_records;
CREATE TABLE IF NOT EXISTS backup_20260915.overtime_approvals AS
  SELECT * FROM public.overtime_approvals;
CREATE TABLE IF NOT EXISTS backup_20260915.time_bank_movements AS
  SELECT * FROM public.time_bank_movements;
CREATE TABLE IF NOT EXISTS backup_20260915.time_bank_monthly_closures AS
  SELECT * FROM public.time_bank_monthly_closures;
CREATE TABLE IF NOT EXISTS backup_20260915.employee_schedules AS
  SELECT * FROM public.employee_schedules;
CREATE TABLE IF NOT EXISTS backup_20260915.schedule_templates AS
  SELECT * FROM public.schedule_templates;
CREATE TABLE IF NOT EXISTS backup_20260915.schedule_template_days AS
  SELECT * FROM public.schedule_template_days;
CREATE TABLE IF NOT EXISTS backup_20260915.time_adjustment_logs AS
  SELECT * FROM public.time_adjustment_logs;

-- Funcionários SEM pin_code nem dados sensíveis desnecessários
CREATE TABLE IF NOT EXISTS backup_20260915.employees_min AS
  SELECT id, first_name, last_name, status, schedule_template_id, auto_clock,
         department_id, manager_id, user_id
  FROM public.employees;

-- Configuração do agendamento (cron) antes de ser alterada
CREATE TABLE IF NOT EXISTS backup_20260915.cron_jobs AS
  SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
  FROM cron.job;

-- Definição das funções de fecho antes da consolidação
CREATE TABLE IF NOT EXISTS backup_20260915.function_defs AS
  SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition, now() AS captured_at
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('close_time_bank_month','cron_close_all_months','cron_close_month_if_last_day','reopen_time_bank_month','review_overtime_approval');

REVOKE ALL ON ALL TABLES IN SCHEMA backup_20260915 FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_20260915 FROM anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA backup_20260915 TO service_role;

-- Verificação de contagens: falha a migração se o backup não bater com a origem
DO $$
DECLARE
  r record;
  src bigint;
  dst bigint;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
      'time_clock_records','overtime_approvals','time_bank_movements',
      'time_bank_monthly_closures','employee_schedules','schedule_templates',
      'schedule_template_days','time_adjustment_logs']) AS t
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO src;
    EXECUTE format('SELECT count(*) FROM backup_20260915.%I', r.t) INTO dst;
    IF src <> dst THEN
      RAISE EXCEPTION 'Backup inconsistente em %: origem % / cópia %', r.t, src, dst;
    END IF;
    RAISE NOTICE 'Backup % OK: % linhas', r.t, dst;
  END LOOP;
END $$;