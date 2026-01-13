-- ============================================================================
-- SOLUÇÃO: Criar RPC function para buscar workspaces do usuário (owned + member)
-- Isso contorna problemas de RLS quando fazendo joins
-- ============================================================================

-- Função para buscar todos os workspaces que o usuário tem acesso (owner ou member)
CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  owner_id UUID,
  settings JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  plan_id UUID,
  user_role TEXT,
  plan JSONB,
  subscription JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  -- Get workspaces where user is owner
  SELECT
    w.id,
    w.name,
    w.slug,
    w.owner_id,
    w.settings,
    w.created_at,
    w.updated_at,
    w.plan_id,
    'owner'::TEXT as user_role,
    row_to_json(p.*)::JSONB as plan,
    row_to_json(s.*)::JSONB as subscription
  FROM workspaces w
  LEFT JOIN plans p ON w.plan_id = p.id
  LEFT JOIN subscriptions s ON w.id = s.workspace_id
  WHERE w.owner_id = current_user_id

  UNION ALL

  -- Get workspaces where user is member (via workspace_users)
  SELECT
    w.id,
    w.name,
    w.slug,
    w.owner_id,
    w.settings,
    w.created_at,
    w.updated_at,
    w.plan_id,
    wu.role::TEXT as user_role,
    row_to_json(p.*)::JSONB as plan,
    row_to_json(s.*)::JSONB as subscription
  FROM workspace_users wu
  INNER JOIN workspaces w ON wu.workspace_id = w.id
  LEFT JOIN plans p ON w.plan_id = p.id
  LEFT JOIN subscriptions s ON w.id = s.workspace_id
  WHERE wu.user_id = current_user_id
    AND wu.status = 'active'

  ORDER BY created_at DESC;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_user_workspaces IS 'Retorna todos os workspaces que o usuário tem acesso (owner ou member ativo)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_workspaces TO authenticated;

-- Mensagem de sucesso
SELECT '✅ Função get_user_workspaces criada com sucesso!' as status;
