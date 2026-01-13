-- ============================================================================
-- DIAGNÓSTICO E CORREÇÃO: Verificar e corrigir workspace do Matheus
-- ============================================================================

-- 1. Ver o estado atual
SELECT 
  u.email,
  w.name as workspace_name,
  w.id as workspace_id,
  w.owner_id,
  wu.role,
  wu.status,
  CASE 
    WHEN w.owner_id = u.id THEN 'É OWNER'
    WHEN wu.user_id IS NOT NULL THEN 'É MEMBRO'
    ELSE 'SEM WORKSPACE'
  END as tipo_acesso
FROM auth.users u
LEFT JOIN workspaces w ON w.owner_id = u.id
LEFT JOIN workspace_users wu ON wu.user_id = u.id
WHERE u.email IN ('ph@suplelive.com.br', 'contato@suplelive.com.br')
ORDER BY u.email;

-- 2. Ver os IDs que vamos usar
SELECT 
  'Usuario ph@suplelive.com.br' as label,
  id as user_id 
FROM auth.users 
WHERE email = 'ph@suplelive.com.br'
UNION ALL
SELECT 
  'Usuario contato@suplelive.com.br' as label,
  id as user_id 
FROM auth.users 
WHERE email = 'contato@suplelive.com.br'
UNION ALL
SELECT 
  'Workspace suplelive' as label,
  id as workspace_id 
FROM workspaces 
WHERE name = 'suplelive' AND owner_id = (
  SELECT id FROM auth.users WHERE email = 'ph@suplelive.com.br'
);

-- 3. LIMPAR qualquer entrada incorreta do Matheus em workspace_users
DELETE FROM workspace_users
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'contato@suplelive.com.br');

-- 4. INSERIR Matheus no workspace correto como admin
INSERT INTO workspace_users (workspace_id, user_id, role, status)
SELECT 
  w.id as workspace_id,
  u.id as user_id,
  'admin' as role,
  'active' as status
FROM workspaces w
CROSS JOIN auth.users u
WHERE w.name = 'suplelive' 
  AND w.owner_id = (SELECT id FROM auth.users WHERE email = 'ph@suplelive.com.br')
  AND u.email = 'contato@suplelive.com.br'
ON CONFLICT (workspace_id, user_id) 
DO UPDATE SET 
  role = 'admin',
  status = 'active';

-- 5. VERIFICAR resultado
SELECT 
  u.email,
  w.name as workspace_name,
  wu.role,
  wu.status,
  w.owner_id = u.id as is_owner
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
WHERE w.name = 'suplelive'
ORDER BY wu.role DESC;

SELECT '✅ Matheus agora está no workspace correto como admin!' as status;
