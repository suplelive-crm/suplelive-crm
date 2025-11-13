-- ============================================================================
-- FIX ORDERS TABLE - VERIFICAR E AJUSTAR RLS
-- ============================================================================
-- Execute este script no Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Verificar se RLS está habilitado
SELECT
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'orders';

-- 2. Listar políticas RLS existentes
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders';

-- 3. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders" ON public.orders;

-- 4. Criar políticas RLS permissivas (permite todos os usuários autenticados)
CREATE POLICY "Allow authenticated users to view orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (true);

-- 5. Habilitar RLS na tabela
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 6. Verificar configuração final
SELECT
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'orders';

SELECT
  policyname,
  cmd as "Command",
  CASE
    WHEN cmd = 'SELECT' THEN 'Permite visualizar'
    WHEN cmd = 'INSERT' THEN 'Permite inserir'
    WHEN cmd = 'UPDATE' THEN 'Permite atualizar'
    WHEN cmd = 'DELETE' THEN 'Permite deletar'
    ELSE 'Todos'
  END as "Descrição"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders'
ORDER BY policyname;
