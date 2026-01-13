-- ============================================================================
-- CORREÇÃO: Remover registro incorreto de cliente
-- ============================================================================

-- 1. ANTES DE DELETAR: Ver o que será removido
SELECT
  id,
  name,
  email,
  user_id,
  workspace_id,
  created_at
FROM clients
WHERE id = '3dfcc2ba-099d-44dc-940d-a7f64e44aca7';
-- Este é o registro "SOLRAC" com email contato@suplelive.com.br mas user_id do Paulo

-- 2. DELETAR o registro incorreto
DELETE FROM clients
WHERE id = '3dfcc2ba-099d-44dc-940d-a7f64e44aca7';

-- 3. Verificar resultado - agora deve ter apenas 2 registros corretos
SELECT
  id,
  name,
  email,
  user_id,
  workspace_id
FROM clients
WHERE email IN ('ph@suplelive.com.br', 'contato@suplelive.com.br')
ORDER BY created_at DESC;

-- Deve mostrar:
-- 1. Matheus Muniz (contato@suplelive.com.br) - user_id do Matheus ✅
-- 2. paulo henrique de abreu (ph@suplelive.com.br) - user_id do Paulo ✅

SELECT '✅ Correção aplicada! Teste novamente.' as status;
