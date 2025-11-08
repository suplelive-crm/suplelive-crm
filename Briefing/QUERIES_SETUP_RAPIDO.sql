-- ============================================================================
-- QUERIES RÁPIDAS PARA SETUP DO BANCO
-- ============================================================================
-- Execute estas queries uma por vez no SQL Editor do Supabase
-- ============================================================================

-- ============================================================================
-- QUERY 1: VERIFICAR WORKSPACES EXISTENTES
-- ============================================================================
-- Execute esta primeiro para ver se você tem workspaces

SELECT
  id,
  name,
  slug,
  created_at,
  settings IS NOT NULL as tem_settings
FROM workspaces
ORDER BY created_at DESC;

-- Se retornar vazio, você precisa criar um workspace primeiro!

-- ============================================================================
-- QUERY 2: CRIAR WORKSPACE (se não existir)
-- ============================================================================
-- Só execute se a Query 1 retornar vazio

INSERT INTO workspaces (name, slug, settings, created_at)
VALUES (
  'Meu Workspace',
  'meu-workspace',
  '{}'::jsonb,
  NOW()
)
RETURNING id, name;

-- IMPORTANTE: Anote o ID retornado!

-- ============================================================================
-- QUERY 3: VERIFICAR TABELAS EVENT-DRIVEN
-- ============================================================================
-- Verifica se as 4 tabelas necessárias existem

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('event_queue', 'baselinker_sync_state', 'scheduled_messages', 'notifications')
ORDER BY table_name;

-- Deve retornar 4 linhas. Se não retornar, execute o 00_SETUP_COMPLETO_DATABASE.sql

-- ============================================================================
-- QUERY 4: VERIFICAR EXTENSÕES
-- ============================================================================
-- Verifica se as extensões necessárias estão habilitadas

SELECT
  extname as extensao,
  extversion as versao
FROM pg_extension
WHERE extname IN ('pg_net', 'pg_cron', 'uuid-ossp')
ORDER BY extname;

-- Deve retornar 3 linhas (pg_net, pg_cron, uuid-ossp)

-- ============================================================================
-- QUERY 5: HABILITAR EXTENSÕES (se não existirem)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- QUERY 6: CONFIGURAR CREDENCIAIS DO WORKSPACE
-- ============================================================================
-- IMPORTANTE: Substitua os valores antes de executar!

-- Primeiro, pegar o ID do workspace
SELECT id, name FROM workspaces;

-- Depois, atualizar com as credenciais
UPDATE workspaces
SET settings = '{
  "baselinker": {
    "enabled": true,
    "token": "COLE_SEU_TOKEN_BASELINKER_AQUI",
    "warehouse_es": 1,
    "warehouse_sp": 2
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://sua-evolution-api.com",
    "api_key": "COLE_SUA_KEY_EVOLUTION_AQUI"
  },
  "openai": {
    "enabled": false,
    "api_key": "",
    "model": "gpt-4"
  },
  "n8n": {
    "enabled": false,
    "webhook_url": ""
  }
}'::jsonb
WHERE id = 'COLE_O_ID_DO_WORKSPACE_AQUI';

-- VERIFICAR se salvou corretamente
SELECT
  name,
  settings->'baselinker'->>'enabled' as baselinker_ativo,
  CASE
    WHEN settings->'baselinker'->>'token' IS NOT NULL AND settings->'baselinker'->>'token' != ''
    THEN '✓ Configurado'
    ELSE '✗ Não configurado'
  END as baselinker_token,
  settings->'evolution'->>'enabled' as evolution_ativo,
  CASE
    WHEN settings->'evolution'->>'api_key' IS NOT NULL AND settings->'evolution'->>'api_key' != ''
    THEN '✓ Configurado'
    ELSE '✗ Não configurado'
  END as evolution_key
FROM workspaces;

-- Deve mostrar "✓ Configurado" nas duas colunas

-- ============================================================================
-- QUERY 7: CRIAR ESTADO DE SINCRONIZAÇÃO
-- ============================================================================
-- IMPORTANTE: Substitua o workspace_id

-- Deletar estado anterior (se existir)
DELETE FROM baselinker_sync_state WHERE workspace_id = 'SEU_WORKSPACE_ID';

-- Criar novo estado
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('SEU_WORKSPACE_ID', 0, false);

-- VERIFICAR
SELECT
  workspace_id,
  last_log_id,
  is_syncing,
  last_sync_at
FROM baselinker_sync_state;

-- Deve retornar 1 linha

-- ============================================================================
-- QUERY 8: CONFIGURAR VARIÁVEIS DO SISTEMA
-- ============================================================================

-- Configurar URL do projeto
ALTER ROLE postgres
SET app.supabase_url TO 'https://oqwstanztqdiexgrpdta.supabase.co';

-- Configurar Service Role Key (pegar em Project Settings → API)
ALTER ROLE postgres
SET app.service_role_key TO 'COLE_SUA_SERVICE_ROLE_KEY_AQUI';

-- VERIFICAR
SELECT * FROM check_event_system_config();

-- Deve mostrar is_configured = true para ambas

-- ============================================================================
-- QUERY 9: CONFIGURAR CRON JOB - EVENT POLLER (a cada 1 minuto)
-- ============================================================================

-- Remover job anterior (se existir)
SELECT cron.unschedule('baselinker-event-poller');

-- Criar novo job
SELECT cron.schedule(
  'baselinker-event-poller',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/baselinker-event-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- QUERY 10: CONFIGURAR CRON JOB - SCHEDULED MESSAGES (diariamente às 9h)
-- ============================================================================

-- Remover job anterior (se existir)
SELECT cron.unschedule('send-scheduled-messages');

-- Criar novo job
SELECT cron.schedule(
  'send-scheduled-messages',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- VERIFICAR cron jobs criados
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- Deve retornar 2 jobs com active = t (true)

-- ============================================================================
-- QUERY 11: TESTAR O POLLER MANUALMENTE
-- ============================================================================

SELECT net.http_post(
  url := current_setting('app.supabase_url') || '/functions/v1/baselinker-event-poller',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
  ),
  body := '{}'::jsonb
);

-- Aguarde 5-10 segundos após executar

-- ============================================================================
-- QUERY 12: VERIFICAR EVENTOS COLETADOS
-- ============================================================================

SELECT
  event_name,
  order_id,
  status,
  created_at,
  error_message
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;

-- Se retornar eventos, funcionou! 🎉

-- ============================================================================
-- QUERY 13: VER LOGS DO CRON JOB
-- ============================================================================

SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Mostra as últimas execuções do cron

-- ============================================================================
-- QUERY 14: ESTATÍSTICAS DE EVENTOS
-- ============================================================================

SELECT
  status,
  COUNT(*) as total,
  MAX(created_at) as ultimo_evento
FROM event_queue
GROUP BY status
ORDER BY status;

-- ============================================================================
-- QUERY 15: VER EVENTOS COM ERRO
-- ============================================================================

SELECT
  event_name,
  order_id,
  error_message,
  retry_count,
  created_at
FROM event_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- QUERY 16: VER MENSAGENS AGENDADAS PENDENTES
-- ============================================================================

SELECT
  message_type,
  scheduled_for,
  status,
  created_at
FROM scheduled_messages
WHERE status = 'pending'
ORDER BY scheduled_for ASC
LIMIT 10;

-- ============================================================================
-- QUERY 17: VER ÚLTIMO SYNC DO BASELINKER
-- ============================================================================

SELECT
  w.name as workspace_name,
  bss.last_log_id,
  bss.last_sync_at,
  bss.is_syncing,
  bss.sync_errors
FROM baselinker_sync_state bss
JOIN workspaces w ON w.id = bss.workspace_id;

-- ============================================================================
-- FIM
-- ============================================================================
