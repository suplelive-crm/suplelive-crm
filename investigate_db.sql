-- Investigar a estrutura exata da tabela auth.users
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- Ver todos os usuários
SELECT id, email, raw_user_meta_data FROM auth.users;

-- Ver todos os workspaces
SELECT id, name, owner_id FROM workspaces;

-- Ver workspace_users
SELECT wu.*, u.email 
FROM workspace_users wu
JOIN auth.users u ON wu.user_id = u.id;

-- Ver a função atual
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_workspace_users_with_details';

-- Testar a função manualmente
SELECT * FROM get_workspace_users_with_details('ec73946f-ec8f-41f0-92a6-b26a40c8262c');
