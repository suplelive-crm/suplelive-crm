-- ============================================================================
-- Script de Diagnóstico do Sistema de Logs
-- ============================================================================
-- Execute este script no Supabase SQL Editor para verificar se tudo está OK
-- ============================================================================

-- 1. Verificar se a função RPC existe
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'upsert_product_stock_with_log';

-- Esperado: Deve retornar 1 linha com a definição da função
-- Se retornar vazio: Execute ADD_STOCK_UPDATE_FUNCTION.sql

-- ============================================================================
-- 2. Verificar se o trigger existe e está ativo
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_log_stock_change';

-- Esperado: Deve retornar 1 linha mostrando o trigger
-- Se retornar vazio: Execute CREATE_LOGS_TABLES.sql novamente

-- ============================================================================
-- 3. Verificar se as tabelas existem
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('stock_change_logs', 'event_queue', 'baselinker_sync_state')
AND table_schema = 'public';

-- Esperado: Deve retornar 3 linhas
-- Se retornar menos: Execute CREATE_LOGS_TABLES.sql novamente

-- ============================================================================
-- 4. Verificar se a view existe
SELECT table_name
FROM information_schema.views
WHERE table_name = 'v_recent_stock_changes'
AND table_schema = 'public';

-- Esperado: Deve retornar 1 linha
-- Se retornar vazio: Execute CREATE_LOGS_TABLES.sql novamente

-- ============================================================================
-- 5. Contar quantos logs existem na tabela
SELECT COUNT(*) as total_logs
FROM public.stock_change_logs;

-- Esperado: Se você já sincronizou, deve ter registros
-- Se retornar 0: Os logs não estão sendo criados

-- ============================================================================
-- 6. Ver os últimos 10 logs (se existirem)
SELECT
  sku,
  product_name,
  warehouse_id,
  source,
  action_type,
  previous_quantity,
  new_quantity,
  quantity_change,
  created_at
FROM public.stock_change_logs
ORDER BY created_at DESC
LIMIT 10;

-- Esperado: Deve mostrar os logs mais recentes
-- Se retornar vazio: Os logs não estão sendo criados

-- ============================================================================
-- 7. Verificar dados pela view (como o frontend faz)
SELECT
  sku,
  product_name,
  warehouse_name,
  source,
  action_type,
  quantity_change,
  created_at
FROM public.v_recent_stock_changes
ORDER BY created_at DESC
LIMIT 10;

-- Esperado: Deve mostrar os mesmos dados da query anterior
-- Se retornar vazio mas a query #6 retornou dados: Problema na view

-- ============================================================================
-- 8. Testar a função RPC manualmente
-- ATENÇÃO: Substitua os valores abaixo pelos seus dados reais antes de executar
/*
SELECT public.upsert_product_stock_with_log(
  p_workspace_id := (SELECT id FROM public.workspaces LIMIT 1), -- Pega primeiro workspace
  p_product_id := (SELECT id FROM public.products LIMIT 1), -- Pega primeiro produto
  p_warehouse_id := 'bl_test',
  p_sku := 'TEST-LOG-001',
  p_ean := '1234567890',
  p_product_name := 'Produto Teste Log',
  p_cost := 10.00,
  p_price := 25.00,
  p_duracao := 30,
  p_stock_quantity := 999, -- Quantidade de teste
  p_source := 'baselinker',
  p_action_type := 'sync',
  p_change_reason := 'Teste manual do sistema de logs'
);

-- Depois execute:
SELECT * FROM public.stock_change_logs
WHERE sku = 'TEST-LOG-001'
ORDER BY created_at DESC
LIMIT 1;

-- Esperado: Deve retornar 1 log do teste
-- Se não retornar: A função RPC ou o trigger têm problemas
*/

-- ============================================================================
-- 9. Verificar erros recentes no PostgreSQL (requer permissões especiais)
-- Se você tiver acesso, pode executar:
/*
SELECT * FROM pg_stat_statements
WHERE query LIKE '%stock_change_logs%'
ORDER BY calls DESC
LIMIT 10;
*/

-- ============================================================================
-- DIAGNÓSTICO COMPLETO
-- ============================================================================
-- Execute todas as queries acima em ordem
-- Anote quais retornaram vazio ou erro
-- Isso ajudará a identificar onde está o problema
-- ============================================================================
