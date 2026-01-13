-- ============================================================================
-- LIMPEZA: Remover entradas desnecessárias de workspace_users
-- Se um usuário é owner do workspace, ele NÃO precisa estar em workspace_users
-- ============================================================================

-- 1. Ver quantos registros duplicados temos (owner que também está em workspace_users)
SELECT
  u.email,
  w.name as workspace_name,
  w.owner_id,
  wu.user_id,
  wu.role,
  wu.status
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
WHERE w.owner_id = wu.user_id;  -- Owner que também está em workspace_users

-- 2. ANTES DE DELETAR: Fazer backup (copiar para ver depois)
-- Execute este SELECT primeiro para ver o que será deletado
SELECT
  wu.id,
  w.name as workspace_name,
  u.email as user_email,
  wu.role,
  'OWNER duplicado em workspace_users' as reason
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
WHERE w.owner_id = wu.user_id;

-- 3. DELETAR os registros duplicados
-- CUIDADO: Só execute se tiver certeza!
-- Owners não precisam estar em workspace_users
DELETE FROM workspace_users
WHERE id IN (
  SELECT wu.id
  FROM workspace_users wu
  JOIN workspaces w ON wu.workspace_id = w.id
  WHERE w.owner_id = wu.user_id
);

-- 4. Verificar resultado
SELECT
  u.email,
  COUNT(DISTINCT CASE WHEN w.owner_id = u.id THEN w.id END) as owned_workspaces,
  COUNT(DISTINCT wu.workspace_id) as member_workspaces
FROM auth.users u
LEFT JOIN workspaces w ON u.id = w.owner_id
LEFT JOIN workspace_users wu ON u.id = wu.user_id AND wu.status = 'active'
GROUP BY u.id, u.email
ORDER BY u.created_at DESC;
