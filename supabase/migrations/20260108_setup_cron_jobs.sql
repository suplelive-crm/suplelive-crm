-- ============================================================================
-- MIGRATION: Configurar Cron Jobs para Edge Functions
-- Data: 08/01/2026
-- Descrição: Configura pg_cron para executar Edge Functions automaticamente
-- ============================================================================

-- IMPORTANTE: Esta migration requer que a extensão pg_cron esteja habilitada
-- Habilitar em: Dashboard → Database → Extensions → pg_cron

-- Verificar se pg_cron está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE EXCEPTION 'Extensão pg_cron não está habilitada. Habilite em: Dashboard → Database → Extensions';
  END IF;
END $$;

-- ============================================================================
-- CRON JOB 1: Enviar mensagens agendadas (a cada 5 minutos)
-- ============================================================================

SELECT cron.schedule(
  'send-scheduled-messages',       -- Nome do job
  '*/5 * * * *',                   -- A cada 5 minutos
  $$
  SELECT
    net.http_post(
      url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/send-scheduled-messages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- CRON JOB 2: Polling de eventos Baselinker (a cada 1 minuto)
-- ============================================================================

SELECT cron.schedule(
  'baselinker-event-polling',      -- Nome do job
  '* * * * *',                     -- A cada 1 minuto
  $$
  SELECT
    net.http_post(
      url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-event-polling',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- CRON JOB 3: Processar fila de eventos (a cada 1 minuto)
-- ============================================================================

SELECT cron.schedule(
  'process-event-queue',           -- Nome do job
  '* * * * *',                     -- A cada 1 minuto
  $$
  SELECT
    net.http_post(
      url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/process-event-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Verificar jobs criados
-- ============================================================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ CRON JOBS CONFIGURADOS COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Jobs criados:';
  RAISE NOTICE '';
  RAISE NOTICE '1. send-scheduled-messages';
  RAISE NOTICE '   Frequência: A cada 5 minutos';
  RAISE NOTICE '   Função: Envia mensagens agendadas';
  RAISE NOTICE '';
  RAISE NOTICE '2. baselinker-event-polling';
  RAISE NOTICE '   Frequência: A cada 1 minuto';
  RAISE NOTICE '   Função: Busca novos eventos do Baselinker';
  RAISE NOTICE '';
  RAISE NOTICE '3. process-event-queue';
  RAISE NOTICE '   Frequência: A cada 1 minuto';
  RAISE NOTICE '   Função: Processa fila de eventos';
  RAISE NOTICE '';
  RAISE NOTICE 'Para verificar jobs ativos:';
  RAISE NOTICE '  SELECT * FROM cron.job;';
  RAISE NOTICE '';
  RAISE NOTICE 'Para remover um job:';
  RAISE NOTICE '  SELECT cron.unschedule(''nome-do-job'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Para ver histórico de execuções:';
  RAISE NOTICE '  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;';
  RAISE NOTICE '============================================================';
END $$;

-- Exibir jobs criados
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE command LIKE '%send-scheduled-messages%'
   OR command LIKE '%baselinker-event-polling%'
   OR command LIKE '%process-event-queue%';
