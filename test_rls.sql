-- ============================================================================
-- TESTAR RLS: Simular queries como se fosse o usuário contato@suplelive.com.br
-- ============================================================================

-- 1. Verificar se as políticas foram criadas
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('clients', 'orders', 'products')
ORDER BY tablename, policyname;

-- 2. Testar query de clientes (simular como se fosse o usuário logado)
-- Substitua o UUID pelo user_id do contato@suplelive.com.br
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '1d31b777-0da6-4e87-ac99-41f9be517efa';

SELECT COUNT(*) as total_clients
FROM clients
WHERE workspace_id = 'ec73946f-ec8f-41f0-92a6-b26a40c8262c';

RESET role;

-- 3. Verificar se o usuário está corretamente em workspace_users
SELECT 
  wu.workspace_id,
  wu.user_id,
  wu.role,
  wu.status,
  u.email,
  w.name as workspace_name
FROM workspace_users wu
JOIN auth.users u ON wu.user_id = u.id
JOIN workspaces w ON wu.workspace_id = w.id
WHERE u.email = 'contato@suplelive.com.br';

-- 4. Alternativa: DESABILITAR RLS temporariamente para testar
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

SELECT '⚠️ RLS DESABILITADO para teste. Recarregue a página e veja se os dados aparecem.' as status;
