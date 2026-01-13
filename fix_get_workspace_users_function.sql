-- ============================================================================
-- CORREÇÃO FINAL: Função completamente reescrita
-- Abordagem mais simples e direta
-- ============================================================================

DROP FUNCTION IF EXISTS get_workspace_users_with_details(UUID);

CREATE OR REPLACE FUNCTION get_workspace_users_with_details(p_workspace_id UUID)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email VARCHAR(255),
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  workspace_owner_id UUID;
BEGIN
  -- Buscar o owner_id do workspace
  SELECT owner_id INTO workspace_owner_id
  FROM workspaces
  WHERE id = p_workspace_id;

  -- Se não encontrou o workspace, retornar vazio
  IF workspace_owner_id IS NULL THEN
    RETURN;
  END IF;

  -- Retornar o owner primeiro
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', u.email)::TEXT,
    u.email,
    'owner'::TEXT,
    'active'::TEXT,
    u.created_at
  FROM auth.users u
  WHERE u.id = workspace_owner_id;

  -- Depois retornar os membros (excluindo o owner se ele estiver em workspace_users)
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', u.email)::TEXT,
    u.email,
    wu.role::TEXT,
    wu.status::TEXT,
    wu.created_at
  FROM workspace_users wu
  JOIN auth.users u ON wu.user_id = u.id
  WHERE wu.workspace_id = p_workspace_id
    AND wu.user_id != workspace_owner_id;  -- Excluir o owner

  RETURN;
END;
$$;

COMMENT ON FUNCTION get_workspace_users_with_details IS 'Retorna usuários do workspace: owner + membros (sem duplicatas)';

GRANT EXECUTE ON FUNCTION get_workspace_users_with_details TO authenticated;

-- Testar a função (substitua o UUID pelo ID real do workspace suplelive)
SELECT * FROM get_workspace_users_with_details('ec73946f-ec8f-41f0-92a6-b26a40c8262c');

SELECT '✅ Função reescrita com abordagem mais simples e robusta!' as status;
