-- ============================================================================
-- INVESTIGAÇÃO: Verificar duplicação de workspaces
-- ============================================================================

-- 1. Verificar todos os workspaces
SELECT
  id,
  name,
  slug,
  owner_id,
  created_at
FROM workspaces
ORDER BY created_at DESC;

-- 2. Verificar todos os usuários
SELECT
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- 3. Verificar workspace_users (relação usuário-workspace)
SELECT
  wu.id,
  wu.workspace_id,
  wu.user_id,
  wu.role,
  wu.status,
  wu.created_at,
  w.name as workspace_name,
  u.email as user_email
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
ORDER BY wu.created_at DESC;

-- 4. Verificar se há workspaces duplicados (mesmo nome)
SELECT
  name,
  COUNT(*) as count,
  array_agg(id) as workspace_ids,
  array_agg(owner_id) as owner_ids
FROM workspaces
GROUP BY name
HAVING COUNT(*) > 1;

-- 5. Verificar a função RPC que criamos
SELECT
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'get_user_workspaces';

-- 6. Testar a função RPC para o usuário ph@suplelive.com.br
-- (Substitua o user_id pelo ID real do usuário)
SELECT * FROM get_user_workspaces();
