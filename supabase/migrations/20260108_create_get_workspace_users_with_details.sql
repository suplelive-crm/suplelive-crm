-- ============================================================================
-- MIGRATION: Criar Função RPC para Buscar Usuários do Workspace com Detalhes
-- Data: 08/01/2026
-- Descrição: Cria função que retorna workspace_users com detalhes dos usuários
--            do auth.users, contornando problema de relacionamento no schema cache
-- ============================================================================

-- Função para buscar workspace_users com detalhes do auth.users
CREATE OR REPLACE FUNCTION get_workspace_users_with_details(p_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  user_id UUID,
  role TEXT,
  invited_by UUID,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_email TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wu.id,
    wu.workspace_id,
    wu.user_id,
    wu.role,
    wu.invited_by,
    wu.invited_at,
    wu.joined_at,
    wu.status,
    wu.created_at,
    wu.updated_at,
    au.email::TEXT as user_email,
    COALESCE(
      au.raw_user_meta_data->>'name',
      au.email
    )::TEXT as user_name
  FROM workspace_users wu
  INNER JOIN auth.users au ON wu.user_id = au.id
  WHERE wu.workspace_id = p_workspace_id
  ORDER BY wu.created_at DESC;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_workspace_users_with_details IS 'Retorna workspace_users com detalhes do auth.users (email e nome)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_workspace_users_with_details TO authenticated;

-- Função para buscar user_invitations com detalhes de quem convidou
CREATE OR REPLACE FUNCTION get_user_invitations_with_details(p_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  role TEXT,
  invited_by UUID,
  token TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  invited_by_email TEXT,
  invited_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ui.id,
    ui.workspace_id,
    ui.email,
    ui.role,
    ui.invited_by,
    ui.token,
    ui.expires_at,
    ui.status,
    ui.created_at,
    ui.updated_at,
    au.email::TEXT as invited_by_email,
    COALESCE(
      au.raw_user_meta_data->>'name',
      au.email
    )::TEXT as invited_by_name
  FROM user_invitations ui
  INNER JOIN auth.users au ON ui.invited_by = au.id
  WHERE ui.workspace_id = p_workspace_id
    AND ui.status = 'pending'
  ORDER BY ui.created_at DESC;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_user_invitations_with_details IS 'Retorna user_invitations com detalhes de quem convidou (email e nome)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_invitations_with_details TO authenticated;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ FUNÇÕES RPC CRIADAS COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Funções disponíveis:';
  RAISE NOTICE '  - get_workspace_users_with_details(workspace_id)';
  RAISE NOTICE '  - get_user_invitations_with_details(workspace_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Uso no frontend:';
  RAISE NOTICE '  supabase.rpc(''get_workspace_users_with_details'', {';
  RAISE NOTICE '    p_workspace_id: workspace.id';
  RAISE NOTICE '  })';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;
