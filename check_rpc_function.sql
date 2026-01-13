-- ============================================================================
-- Verificar a função RPC get_workspace_users_with_details
-- ============================================================================

-- 1. Ver o código da função atual
SELECT
  pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_workspace_users_with_details';

-- 2. Testar a função manualmente para um workspace específico
-- (Substitua o UUID pelo ID real do workspace "suplelive")
SELECT * FROM get_workspace_users_with_details(
  'REPLACE_WITH_WORKSPACE_ID'::uuid
);

-- 3. Para encontrar o workspace_id do "suplelive":
SELECT id, name, owner_id
FROM workspaces
WHERE name = 'suplelive';
