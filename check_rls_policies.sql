-- Verificar todas as políticas RLS na tabela clients
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
WHERE tablename IN ('clients', 'orders', 'products', 'purchases')
ORDER BY tablename, policyname;

-- Ver se RLS está habilitado nas tabelas
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'orders', 'products', 'purchases', 'transfers', 'returns')
ORDER BY tablename;
