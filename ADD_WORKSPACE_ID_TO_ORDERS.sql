-- ============================================================================
-- FIX: Adicionar coluna workspace_id na tabela orders
-- ============================================================================
-- A coluna workspace_id é essencial para multi-tenancy
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- Passo 1: Adicionar a coluna workspace_id (permitir NULL temporariamente)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Passo 2: Verificar pedidos órfãos (sem client_id ou client inexistente)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.orders o
  LEFT JOIN public.clients c ON o.client_id = c.id
  WHERE c.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'AVISO: Encontrados % pedidos órfãos (sem cliente válido)', orphan_count;
    RAISE NOTICE 'Estes pedidos serão DELETADOS para permitir a migração';

    -- Deletar pedidos órfãos
    DELETE FROM public.orders o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = o.client_id
    );

    RAISE NOTICE 'Pedidos órfãos deletados com sucesso';
  END IF;
END $$;

-- Passo 3: Preencher workspace_id existente com base no client_id
UPDATE public.orders o
SET workspace_id = c.workspace_id
FROM public.clients c
WHERE o.client_id = c.id
  AND o.workspace_id IS NULL;

-- Passo 4: Verificar se ainda há registros sem workspace_id
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.orders
  WHERE workspace_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Ainda existem % pedidos sem workspace_id. Não é possível prosseguir.', null_count;
  END IF;
END $$;

-- Passo 5: Tornar a coluna NOT NULL (depois que todos os registros foram preenchidos)
ALTER TABLE public.orders
ALTER COLUMN workspace_id SET NOT NULL;

-- Passo 4: Adicionar foreign key constraint
ALTER TABLE public.orders
ADD CONSTRAINT orders_workspace_id_fkey
FOREIGN KEY (workspace_id)
REFERENCES public.workspaces(id)
ON DELETE CASCADE;

-- Passo 5: Adicionar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_orders_workspace_id
ON public.orders(workspace_id);

-- Passo 6: Adicionar índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_orders_workspace_order_date
ON public.orders(workspace_id, order_date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_workspace_status
ON public.orders(workspace_id, status);

-- ============================================================================
-- Verificação
-- ============================================================================
-- Verificar se a coluna foi adicionada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'workspace_id';

-- Verificar índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders' AND indexname LIKE '%workspace%';

-- Verificar se há registros sem workspace_id
SELECT COUNT(*) as orders_without_workspace
FROM public.orders
WHERE workspace_id IS NULL;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
