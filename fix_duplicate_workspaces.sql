-- ============================================================================
-- CORREÇÃO: Evitar workspaces duplicados na função get_user_workspaces
-- O problema ocorre quando um usuário é owner E também está em workspace_users
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_workspaces();

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
  WITH user_workspaces AS (
    -- Get workspaces where user is owner
    SELECT DISTINCT
      w.id,
      w.name,
      w.slug,
      w.owner_id,
      w.settings,
      w.created_at,
      w.updated_at,
      w.plan_id,
      'owner'::TEXT as user_role
    FROM workspaces w
    WHERE w.owner_id = current_user_id

    UNION

    -- Get workspaces where user is member (via workspace_users)
    -- But EXCLUDE if user is already the owner (to avoid duplicates)
    SELECT DISTINCT
      w.id,
      w.name,
      w.slug,
      w.owner_id,
      w.settings,
      w.created_at,
      w.updated_at,
      w.plan_id,
      wu.role::TEXT as user_role
    FROM workspace_users wu
    INNER JOIN workspaces w ON wu.workspace_id = w.id
    WHERE wu.user_id = current_user_id
      AND wu.status = 'active'
      AND w.owner_id != current_user_id  -- CRUCIAL: Exclude if user is owner
  )
  SELECT
    uw.id,
    uw.name,
    uw.slug,
    uw.owner_id,
    uw.settings,
    uw.created_at,
    uw.updated_at,
    uw.plan_id,
    uw.user_role,
    row_to_json(p.*)::JSONB as plan,
    row_to_json(s.*)::JSONB as subscription
  FROM user_workspaces uw
  LEFT JOIN plans p ON uw.plan_id = p.id
  LEFT JOIN subscriptions s ON uw.id = s.workspace_id
  ORDER BY uw.created_at DESC;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_user_workspaces IS 'Retorna todos os workspaces que o usuário tem acesso (owner ou member ativo) - SEM DUPLICATAS';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_workspaces TO authenticated;

-- Mensagem de sucesso
SELECT '✅ Função get_user_workspaces atualizada - duplicatas removidas!' as status;
