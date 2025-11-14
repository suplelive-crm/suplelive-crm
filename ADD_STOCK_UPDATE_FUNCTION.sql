-- ============================================================================
-- Função Helper para Update de Estoque com Logging Automático
-- ============================================================================
-- Esta função permite fazer update de estoque configurando as session variables
-- para o trigger de logging capturar corretamente a origem da alteração
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_product_stock_with_log(
  p_workspace_id UUID,
  p_product_id UUID,
  p_warehouse_id TEXT,
  p_sku TEXT,
  p_ean TEXT,
  p_product_name TEXT,
  p_cost NUMERIC,
  p_price NUMERIC,
  p_duracao NUMERIC,
  p_stock_quantity NUMERIC,
  p_source TEXT DEFAULT 'baselinker',
  p_action_type TEXT DEFAULT 'sync',
  p_change_reason TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Configurar session variables para o trigger
  PERFORM set_config('app.stock_source', p_source, true);
  PERFORM set_config('app.stock_action_type', p_action_type, true);

  IF p_change_reason IS NOT NULL THEN
    PERFORM set_config('app.stock_change_reason', p_change_reason, true);
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.user_id', p_user_id::text, true);
  END IF;

  -- Fazer o upsert do estoque
  INSERT INTO public.product_stock_by_warehouse (
    workspace_id,
    product_id,
    warehouse_id,
    sku,
    ean,
    product_name,
    cost,
    price,
    duracao,
    stock_quantity,
    last_sync_at,
    updated_at
  ) VALUES (
    p_workspace_id,
    p_product_id,
    p_warehouse_id,
    p_sku,
    p_ean,
    p_product_name,
    p_cost,
    p_price,
    p_duracao,
    p_stock_quantity,
    NOW(),
    NOW()
  )
  ON CONFLICT (workspace_id, sku, warehouse_id)
  DO UPDATE SET
    product_id = EXCLUDED.product_id,
    ean = EXCLUDED.ean,
    product_name = EXCLUDED.product_name,
    cost = EXCLUDED.cost,
    price = EXCLUDED.price,
    duracao = EXCLUDED.duracao,
    stock_quantity = EXCLUDED.stock_quantity,
    last_sync_at = EXCLUDED.last_sync_at,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário
COMMENT ON FUNCTION public.upsert_product_stock_with_log IS 'Faz upsert de estoque configurando session variables para logging automático via trigger';

-- ============================================================================
-- Teste da função
-- ============================================================================
-- Para testar (não execute em produção sem ajustar os valores):
/*
SELECT public.upsert_product_stock_with_log(
  p_workspace_id := 'YOUR_WORKSPACE_ID'::uuid,
  p_product_id := 'YOUR_PRODUCT_ID'::uuid,
  p_warehouse_id := 'bl_12345',
  p_sku := 'TEST-SKU',
  p_ean := '1234567890123',
  p_product_name := 'Produto Teste',
  p_cost := 10.50,
  p_price := 25.00,
  p_duracao := 30,
  p_stock_quantity := 100,
  p_source := 'baselinker',
  p_action_type := 'sync',
  p_change_reason := 'Sincronização automática do Baselinker'
);

-- Verificar log criado
SELECT * FROM public.stock_change_logs ORDER BY created_at DESC LIMIT 1;
*/

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
