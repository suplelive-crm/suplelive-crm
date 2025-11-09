-- ============================================================================
-- CREATE/RECREATE v_recent_stock_changes VIEW
-- ============================================================================
-- This view was supposed to be created in 20250107_stock_logs_enhancement.sql
-- but apparently wasn't applied or the view doesn't exist in the database.
-- This migration ensures it exists.
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CREATING v_recent_stock_changes VIEW';
  RAISE NOTICE '========================================';
END $$;

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.v_recent_stock_changes CASCADE;

DO $$ BEGIN RAISE NOTICE '  ✓ View antiga removida (se existia)'; END $$;

-- Create view that shows recent stock changes from stock_change_log
-- NOTE: This view is used by JobsPage to display stock changes
-- NOTE: Using columns from 20250108_fix_orders_and_missing_tables.sql schema
CREATE OR REPLACE VIEW public.v_recent_stock_changes AS
SELECT
  scl.id,
  scl.workspace_id,
  scl.sku,
  p.name as product_name,
  scl.warehouse as warehouse_id,
  scl.warehouse as warehouse_name,
  scl.change_type as action_type,
  scl.reference_type as source,
  scl.quantity_before as previous_quantity,
  scl.quantity_after as new_quantity,
  scl.quantity_change,
  scl.notes as change_reason,
  u.email as user_name,
  scl.created_at,
  CASE
    WHEN scl.quantity_change > 0 THEN 'increase'
    WHEN scl.quantity_change < 0 THEN 'decrease'
    ELSE 'no_change'
  END as change_direction
FROM public.stock_change_log scl
LEFT JOIN public.products p ON p.id = scl.product_id
LEFT JOIN auth.users u ON u.id = scl.created_by
WHERE scl.created_at > NOW() - INTERVAL '30 days'
ORDER BY scl.created_at DESC;

DO $$ BEGIN RAISE NOTICE '  ✓ View v_recent_stock_changes criada com sucesso'; END $$;

-- Grant permissions
GRANT SELECT ON public.v_recent_stock_changes TO authenticated;
GRANT SELECT ON public.v_recent_stock_changes TO service_role;

DO $$ BEGIN RAISE NOTICE '  ✓ Permissões concedidas'; END $$;

-- ============================================================================
-- FINAL MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ VIEW CRIADA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'A view v_recent_stock_changes agora está disponível';
  RAISE NOTICE 'e mostra as últimas alterações de estoque dos últimos 30 dias.';
  RAISE NOTICE '';
END $$;
