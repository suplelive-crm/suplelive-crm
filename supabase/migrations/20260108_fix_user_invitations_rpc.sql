-- ============================================================================
-- MIGRATION: Fix get_user_invitations_with_details RPC Function
-- Data: 08/01/2026
-- Descrição: Remove referência à coluna updated_at que não existe na tabela
--            user_invitations
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_user_invitations_with_details(UUID);

-- Recreate function without updated_at column
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ FUNÇÃO RPC CORRIGIDA COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'get_user_invitations_with_details agora retorna:';
  RAISE NOTICE '  ✓ Todos os campos corretos da tabela user_invitations';
  RAISE NOTICE '  ✓ Detalhes de quem convidou (email e nome)';
  RAISE NOTICE '  ✗ Removido campo updated_at (não existe na tabela)';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;
