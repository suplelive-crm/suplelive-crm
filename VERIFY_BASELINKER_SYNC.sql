-- ============================================================================
-- Script para Verificar e Corrigir Tabela baselinker_sync
-- ============================================================================
-- Este script verifica se a tabela baselinker_sync está salvando corretamente
-- os timestamps de sincronização
-- ============================================================================

-- ============================================================================
-- 1. Verificar estrutura da tabela baselinker_sync
-- ============================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'baselinker_sync'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Esperado: Deve ter colunas como workspace_id, last_orders_sync, last_products_sync, etc

-- ============================================================================
-- 2. Ver dados atuais da tabela baselinker_sync
-- ============================================================================
SELECT
  bs.workspace_id,
  w.name as workspace_name,
  bs.last_orders_sync,
  bs.last_products_sync,
  bs.last_customers_sync,
  bs.sync_status,
  bs.updated_at,
  bs.created_at
FROM public.baselinker_sync bs
LEFT JOIN public.workspaces w ON w.id = bs.workspace_id
ORDER BY bs.updated_at DESC;

-- ============================================================================
-- 3. Verificar se existe registro para seu workspace
-- ============================================================================
-- Substituir 'YOUR_WORKSPACE_ID' pelo ID do seu workspace
SELECT id, name FROM public.workspaces;

-- Execute depois de pegar o ID:
/*
SELECT *
FROM public.baselinker_sync
WHERE workspace_id = 'YOUR_WORKSPACE_ID';
*/

-- ============================================================================
-- 4. Criar registro inicial se não existir
-- ============================================================================
-- Se não houver registro para seu workspace, execute:
/*
INSERT INTO public.baselinker_sync (
  workspace_id,
  last_orders_sync,
  last_products_sync,
  last_customers_sync,
  sync_status,
  created_at,
  updated_at
)
VALUES (
  'YOUR_WORKSPACE_ID',  -- Substituir pelo ID real
  NULL,  -- Primeira sincronização buscará tudo
  NULL,
  NULL,
  'idle',
  NOW(),
  NOW()
)
ON CONFLICT (workspace_id) DO NOTHING;
*/

-- ============================================================================
-- 5. Verificar última sincronização de pedidos
-- ============================================================================
SELECT
  workspace_id,
  last_orders_sync,
  CASE
    WHEN last_orders_sync IS NULL THEN 'Nunca sincronizou'
    WHEN last_orders_sync < NOW() - INTERVAL '1 day' THEN 'Sincronização antiga (>24h)'
    WHEN last_orders_sync < NOW() - INTERVAL '1 hour' THEN 'Sincronização recente (>1h)'
    ELSE 'Sincronizado recentemente'
  END as status_sincronizacao,
  NOW() - last_orders_sync as tempo_desde_ultima_sync
FROM public.baselinker_sync;

-- ============================================================================
-- 6. Comparar com pedidos no banco
-- ============================================================================
-- Ver o pedido mais recente no banco vs última sincronização
SELECT
  bs.workspace_id,
  bs.last_orders_sync as ultima_sincronizacao,
  MAX(o.order_date) as pedido_mais_recente,
  COUNT(o.id) as total_pedidos
FROM public.baselinker_sync bs
LEFT JOIN public.orders o ON o.workspace_id = bs.workspace_id
GROUP BY bs.workspace_id, bs.last_orders_sync;

-- ============================================================================
-- 7. Forçar reset da sincronização (CUIDADO!)
-- ============================================================================
-- Execute APENAS se quiser forçar uma re-sincronização COMPLETA de todos os pedidos
-- ATENÇÃO: Isso pode criar duplicatas se não for feito corretamente!
/*
UPDATE public.baselinker_sync
SET
  last_orders_sync = NULL,
  updated_at = NOW()
WHERE workspace_id = 'YOUR_WORKSPACE_ID';
*/

-- ============================================================================
-- 8. Verificar pedidos duplicados
-- ============================================================================
-- Ver se existem pedidos duplicados (mesmo order_id_base)
SELECT
  order_id_base,
  COUNT(*) as quantidade,
  STRING_AGG(id::text, ', ') as order_ids
FROM public.orders
WHERE workspace_id IN (SELECT id FROM public.workspaces)
GROUP BY order_id_base, workspace_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- Se houver duplicatas, você pode remover mantendo apenas a mais recente:
/*
DELETE FROM public.orders
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY workspace_id, order_id_base ORDER BY created_at DESC) as rn
    FROM public.orders
  ) t
  WHERE rn > 1
);
*/

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
-- Agora você pode verificar se:
-- 1. A tabela baselinker_sync existe e tem dados
-- 2. last_orders_sync está sendo atualizado após cada sincronização
-- 3. Não existem pedidos duplicados
-- ============================================================================
