-- ============================================================================
-- Inserir configuração dos warehouses do Baselinker
-- ============================================================================
-- IMPORTANTE: Este script descobre automaticamente seus warehouses e cria um template
-- Você só precisa editar os NOMES e CÓDIGOS conforme sua necessidade
-- ============================================================================

-- PASSO 1: Descobrir todos os warehouses que existem nos produtos
-- Execute isto PRIMEIRO para ver quais warehouse_id você tem
SELECT
  warehouse_id,
  COUNT(*) as total_produtos,
  COUNT(DISTINCT sku) as produtos_unicos
FROM public.product_stock_by_warehouse
GROUP BY warehouse_id
ORDER BY warehouse_id;

-- PASSO 2: Ver qual é o seu workspace
SELECT id, name, slug FROM public.workspaces;

-- PASSO 3: Inserir warehouses (EDITE OS NOMES E CÓDIGOS CONFORME SUA NECESSIDADE)
-- Este INSERT usa os warehouse_id reais encontrados na sua tabela
-- ATENÇÃO: Ajuste 'YOUR_WORKSPACE_ID' com o ID do PASSO 2

-- Exemplo de INSERT genérico que você precisa CUSTOMIZAR:
-- Descomente e ajuste conforme os warehouse_id que você viu no PASSO 1

/*
INSERT INTO public.baselinker_warehouses (
  workspace_id,
  warehouse_id,
  warehouse_code,
  warehouse_name,
  is_active,
  allow_stock_updates,
  sync_direction
)
VALUES
  -- ⚠️ CUSTOMIZE CADA LINHA ABAIXO COM OS DADOS DO SEU WAREHOUSE
  (
    'YOUR_WORKSPACE_ID',     -- UUID do seu workspace (do PASSO 2)
    'bl_45090',              -- warehouse_id real (do PASSO 1)
    'WH1',                   -- CUSTOMIZE: código curto (ex: ES, SP, RJ, MG)
    'Meu Warehouse 1',       -- CUSTOMIZE: nome descritivo
    true,
    true,
    'bidirectional'
  ),
  (
    'YOUR_WORKSPACE_ID',
    'bl_45091',              -- warehouse_id real (do PASSO 1)
    'WH2',                   -- CUSTOMIZE: código curto
    'Meu Warehouse 2',       -- CUSTOMIZE: nome descritivo
    true,
    true,
    'bidirectional'
  )
  -- Adicione mais linhas conforme necessário
ON CONFLICT (workspace_id, warehouse_id)
DO UPDATE SET
  warehouse_code = EXCLUDED.warehouse_code,
  warehouse_name = EXCLUDED.warehouse_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
*/

-- ============================================================================
-- Verificação
-- ============================================================================
SELECT
  w.name as workspace,
  bw.warehouse_id,
  bw.warehouse_code,
  bw.warehouse_name,
  bw.is_active
FROM public.baselinker_warehouses bw
JOIN public.workspaces w ON w.id = bw.workspace_id
ORDER BY bw.warehouse_code;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
