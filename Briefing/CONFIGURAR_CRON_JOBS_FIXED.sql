-- ============================================================================
-- CONFIGURAR CRON JOBS - Sistema Multi-Tenant (VERSÃO CORRIGIDA)
-- ============================================================================
-- Execute estas queries DEPOIS de rodar o 00_SETUP_AUTOMATICO_DATABASE.sql
-- ============================================================================

-- ============================================================================
-- PASSO 1: REMOVER CRON JOBS ANTIGOS (se existirem)
-- ============================================================================
-- Usa DO para evitar erros se o job não existir

DO $$
BEGIN
  PERFORM cron.unschedule('baselinker-event-poller');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job baselinker-event-poller não existia (ok)';
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-scheduled-messages');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job send-scheduled-messages não existia (ok)';
END $$;

-- ============================================================================
-- PASSO 2: CRIAR CRON JOB - EVENT POLLER
-- ============================================================================
-- Roda a cada 1 minuto
-- Processa TODOS os workspaces automaticamente

SELECT cron.schedule(
  'baselinker-event-poller',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-event-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- PASSO 3: CRIAR CRON JOB - SCHEDULED MESSAGES
-- ============================================================================
-- Roda diariamente às 9h
-- Envia mensagens agendadas de TODOS os workspaces

SELECT cron.schedule(
  'send-scheduled-messages',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- PASSO 4: VERIFICAR CRON JOBS CRIADOS
-- ============================================================================

SELECT
  jobid,
  jobname,
  schedule,
  active,
  nodename,
  database
FROM cron.job
ORDER BY jobname;

-- Resultado esperado:
-- jobid | jobname                    | schedule  | active | ...
-- ------|----------------------------|-----------|--------|
-- 1     | baselinker-event-poller    | * * * * * | t      | ...
-- 2     | send-scheduled-messages    | 0 9 * * * | t      | ...

-- ✅ Se aparecerem 2 jobs com active = t, está tudo certo!

-- ============================================================================
-- PASSO 5: TESTAR CHAMADA MANUAL DO POLLER
-- ============================================================================
-- Execute esta query para chamar o poller manualmente (teste)

SELECT net.http_post(
  url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-event-poller',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
  ),
  body := '{}'::jsonb
);

-- Aguarde 5-10 segundos após executar

-- ============================================================================
-- PASSO 6: VERIFICAR EVENTOS COLETADOS
-- ============================================================================

SELECT
  w.name as workspace,
  eq.event_name,
  eq.order_id,
  eq.status,
  eq.created_at,
  eq.error_message
FROM event_queue eq
JOIN workspaces w ON w.id = eq.workspace_id
ORDER BY eq.created_at DESC
LIMIT 20;

-- Se retornar eventos, está funcionando! 🎉
-- Se retornar vazio, pode ser que:
--   1. Não há eventos novos no Baselinker
--   2. Workspace não tem credenciais configuradas

-- ============================================================================
-- PASSO 7: VER LOGS DAS EXECUÇÕES DO CRON
-- ============================================================================

SELECT
  j.jobname,
  jrd.runid,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
ORDER BY jrd.start_time DESC
LIMIT 20;

-- ============================================================================
-- QUERIES ÚTEIS DE MONITORAMENTO
-- ============================================================================

-- Ver estatísticas de eventos por workspace
SELECT
  w.name as workspace,
  eq.status,
  COUNT(*) as total,
  MAX(eq.created_at) as ultimo_evento
FROM event_queue eq
JOIN workspaces w ON w.id = eq.workspace_id
GROUP BY w.name, eq.status
ORDER BY w.name, eq.status;

-- Ver workspaces com credenciais configuradas
SELECT
  name as workspace,
  settings->'baselinker'->>'enabled' as baselinker_ativo,
  CASE
    WHEN settings->'baselinker'->>'token' IS NOT NULL AND settings->'baselinker'->>'token' != ''
    THEN '✓ Configurado'
    ELSE '✗ Pendente'
  END as status_baselinker,
  settings->'evolution'->>'enabled' as evolution_ativo,
  CASE
    WHEN settings->'evolution'->>'api_key' IS NOT NULL AND settings->'evolution'->>'api_key' != ''
    THEN '✓ Configurado'
    ELSE '✗ Pendente'
  END as status_evolution
FROM workspaces
ORDER BY name;

-- Ver último sync de cada workspace
SELECT
  w.name as workspace,
  bss.last_log_id,
  bss.last_sync_at,
  bss.is_syncing,
  bss.sync_errors
FROM baselinker_sync_state bss
JOIN workspaces w ON w.id = bss.workspace_id
ORDER BY w.name;

-- Ver eventos com erro
SELECT
  w.name as workspace,
  eq.event_name,
  eq.order_id,
  eq.error_message,
  eq.retry_count,
  eq.created_at
FROM event_queue eq
JOIN workspaces w ON w.id = eq.workspace_id
WHERE eq.status = 'failed'
ORDER BY eq.created_at DESC
LIMIT 20;

-- ============================================================================
-- GERENCIAMENTO DE CRON JOBS
-- ============================================================================

-- Desabilitar um cron job
-- SELECT cron.alter_job(JOBID, enabled := false);

-- Habilitar um cron job
-- SELECT cron.alter_job(JOBID, enabled := true);

-- Deletar um cron job (com tratamento de erro)
-- DO $$
-- BEGIN
--   PERFORM cron.unschedule('nome-do-job');
-- EXCEPTION
--   WHEN OTHERS THEN NULL;
-- END $$;

-- ============================================================================
-- FIM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CRON JOBS CONFIGURADOS COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Resumo:';
  RAISE NOTICE '  ✓ baselinker-event-poller (roda a cada 1 minuto)';
  RAISE NOTICE '  ✓ send-scheduled-messages (roda diariamente às 9h)';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Aguarde 1 minuto para o poller rodar pela primeira vez';
  RAISE NOTICE '  2. Execute a query do Passo 6 para ver eventos coletados';
  RAISE NOTICE '  3. Usuários configuram credenciais no painel web';
  RAISE NOTICE '';
END $$;
