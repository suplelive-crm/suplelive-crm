-- ============================================================================
-- INVESTIGAÇÃO COMPLETA: Verificar dados do Matheus e workspace
-- ============================================================================

-- 1. Ver TODOS os usuários no sistema
SELECT
  id,
  email,
  created_at,
  raw_user_meta_data->>'name' as name
FROM auth.users
ORDER BY created_at DESC;

-- 2. Ver TODOS os workspaces
SELECT
  id,
  name,
  slug,
  owner_id,
  created_at
FROM workspaces
ORDER BY created_at DESC;

-- 3. Ver relação workspace_users - TODOS
SELECT
  wu.id,
  wu.workspace_id,
  wu.user_id,
  wu.role,
  wu.status,
  w.name as workspace_name,
  u.email as user_email,
  w.owner_id as workspace_owner_id,
  CASE
    WHEN w.owner_id = wu.user_id THEN '⚠️ PROBLEMA: User é owner e está em workspace_users'
    ELSE '✅ OK'
  END as status_check
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
ORDER BY wu.created_at DESC;

-- 4. Ver especificamente o workspace "suplelive"
SELECT
  w.id as workspace_id,
  w.name,
  w.slug,
  w.owner_id,
  owner_email.email as owner_email,
  w.created_at
FROM workspaces w
LEFT JOIN auth.users owner_email ON w.owner_id = owner_email.id
WHERE w.name = 'suplelive'
ORDER BY w.created_at DESC;

-- 5. Ver quem tem acesso ao workspace "suplelive" (por workspace_users)
SELECT
  wu.role,
  wu.status,
  u.email as user_email,
  u.id as user_id,
  w.name as workspace_name,
  w.owner_id as workspace_owner_id,
  CASE
    WHEN w.owner_id = u.id THEN '⚠️ É owner - NÃO deveria estar aqui'
    ELSE '✅ OK - É membro'
  END as check
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
WHERE w.name = 'suplelive';

-- 6. Verificar se há duplicatas de workspaces com mesmo nome
SELECT
  name,
  COUNT(*) as total,
  string_agg(id::text, ', ') as workspace_ids,
  string_agg(owner_id::text, ', ') as owner_ids
FROM workspaces
GROUP BY name
HAVING COUNT(*) > 1;

-- 7. Ver a tabela clients (pode ter dados confusos também)
SELECT
  c.id,
  c.name,
  c.email,
  c.workspace_id,
  c.user_id,
  w.name as workspace_name,
  u.email as auth_user_email
FROM clients c
LEFT JOIN workspaces w ON c.workspace_id = w.id
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE c.email IN ('ph@suplelive.com.br', 'contato@suplelive.com.br')
ORDER BY c.created_at DESC;
