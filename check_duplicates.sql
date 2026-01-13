-- Execute este SQL no Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql

-- 1. Ver todos os workspaces
SELECT
  id,
  name,
  slug,
  owner_id,
  created_at
FROM workspaces
ORDER BY created_at DESC;

-- 2. Ver relação workspace_users
SELECT
  wu.id,
  w.name as workspace_name,
  u.email as user_email,
  wu.role,
  wu.status,
  wu.created_at
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
ORDER BY wu.created_at DESC;

-- 3. Verificar duplicados
SELECT
  name,
  COUNT(*) as total,
  string_agg(id::text, ', ') as workspace_ids
FROM workspaces
GROUP BY name
HAVING COUNT(*) > 1;

-- 4. Ver quantos workspaces cada usuário tem acesso
SELECT
  u.email,
  COUNT(DISTINCT CASE WHEN w.owner_id = u.id THEN w.id END) as owned_workspaces,
  COUNT(DISTINCT CASE WHEN wu.workspace_id IS NOT NULL AND wu.status = 'active' THEN wu.workspace_id END) as member_workspaces,
  COUNT(DISTINCT CASE WHEN w.owner_id = u.id THEN w.id END) +
  COUNT(DISTINCT CASE WHEN wu.workspace_id IS NOT NULL AND wu.status = 'active' THEN wu.workspace_id END) as total_access
FROM auth.users u
LEFT JOIN workspaces w ON u.id = w.owner_id
LEFT JOIN workspace_users wu ON u.id = wu.user_id AND wu.status = 'active'
GROUP BY u.id, u.email
ORDER BY u.created_at DESC;
