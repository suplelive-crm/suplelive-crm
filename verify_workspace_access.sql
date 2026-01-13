-- Verificar se Matheus está no workspace correto
SELECT 
  'WORKSPACE CORRETO' as status,
  w.id as workspace_id,
  w.name,
  w.owner_id
FROM workspaces w
WHERE w.name = 'suplelive' 
  AND w.owner_id = (SELECT id FROM auth.users WHERE email = 'ph@suplelive.com.br');

-- Verificar se Matheus está em workspace_users
SELECT 
  'MATHEUS EM WORKSPACE_USERS' as status,
  wu.*,
  w.name as workspace_name
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
WHERE wu.user_id = (SELECT id FROM auth.users WHERE email = 'contato@suplelive.com.br');

-- Verificar quantos clientes cada workspace tem
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  u.email as owner_email,
  COUNT(c.id) as total_clientes
FROM workspaces w
LEFT JOIN auth.users u ON w.owner_id = u.id
LEFT JOIN clients c ON c.workspace_id = w.id
GROUP BY w.id, w.name, w.owner_id, u.email
ORDER BY w.name;

-- Mostrar TODOS os workspaces que existem
SELECT 
  id,
  name,
  owner_id,
  (SELECT email FROM auth.users WHERE id = workspaces.owner_id) as owner_email,
  created_at
FROM workspaces
ORDER BY created_at;
