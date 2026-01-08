-- ============================================================================
-- MIGRATION: Corrigir Políticas RLS de workspace_users e user_invitations
-- Data: 08/01/2026
-- Descrição: Remove recursão infinita nas políticas RLS
-- ============================================================================

-- ============================================================================
-- PARTE 1: REMOVER POLÍTICAS ANTIGAS (com recursão)
-- ============================================================================

-- Remover políticas antigas de workspace_users
DROP POLICY IF EXISTS "Users can view workspace members they belong to" ON workspace_users;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_users;

-- Remover políticas antigas de user_invitations
DROP POLICY IF EXISTS "Users can view workspace invitations" ON user_invitations;
DROP POLICY IF EXISTS "Workspace admins can manage invitations" ON user_invitations;

-- ============================================================================
-- PARTE 2: CRIAR POLÍTICAS SIMPLES (sem recursão)
-- ============================================================================

-- ============================================================================
-- PARTE 2.1: Políticas para workspace_users
-- ============================================================================

-- SELECT: Usuários podem ver membros de workspaces que são donos OU que pertencem
CREATE POLICY "workspace_users_select_policy"
  ON workspace_users
  FOR SELECT
  TO authenticated
  USING (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
    OR
    -- É membro do workspace (verificação direta sem recursão)
    user_id = auth.uid()
  );

-- INSERT: Apenas owners e admins podem adicionar membros
CREATE POLICY "workspace_users_insert_policy"
  ON workspace_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- UPDATE: Apenas owners podem atualizar roles
CREATE POLICY "workspace_users_update_policy"
  ON workspace_users
  FOR UPDATE
  TO authenticated
  USING (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- DELETE: Apenas owners podem remover membros
CREATE POLICY "workspace_users_delete_policy"
  ON workspace_users
  FOR DELETE
  TO authenticated
  USING (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- PARTE 2.2: Políticas para user_invitations
-- ============================================================================

-- SELECT: Ver convites de workspaces que é owner
CREATE POLICY "user_invitations_select_policy"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- INSERT: Apenas owners podem criar convites
CREATE POLICY "user_invitations_insert_policy"
  ON user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- UPDATE: Apenas owners podem atualizar convites
CREATE POLICY "user_invitations_update_policy"
  ON user_invitations
  FOR UPDATE
  TO authenticated
  USING (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- DELETE: Apenas owners podem deletar convites
CREATE POLICY "user_invitations_delete_policy"
  ON user_invitations
  FOR DELETE
  TO authenticated
  USING (
    -- É owner do workspace
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- PARTE 3: VALIDAÇÃO E MENSAGENS
-- ============================================================================

DO $$
DECLARE
  v_workspace_users_policies INTEGER;
  v_user_invitations_policies INTEGER;
BEGIN
  -- Contar políticas criadas
  SELECT COUNT(*)
  INTO v_workspace_users_policies
  FROM pg_policies
  WHERE tablename = 'workspace_users';

  SELECT COUNT(*)
  INTO v_user_invitations_policies
  FROM pg_policies
  WHERE tablename = 'user_invitations';

  -- Exibir resultados
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLÍTICAS RLS CORRIGIDAS!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Políticas removidas (com recursão):';
  RAISE NOTICE '- Users can view workspace members they belong to';
  RAISE NOTICE '- Workspace admins can manage members';
  RAISE NOTICE '- Users can view workspace invitations';
  RAISE NOTICE '- Workspace admins can manage invitations';
  RAISE NOTICE '';
  RAISE NOTICE 'Políticas criadas (simplificadas):';
  RAISE NOTICE '✓ workspace_users: % políticas', v_workspace_users_policies;
  RAISE NOTICE '  - SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '✓ user_invitations: % políticas', v_user_invitations_policies;
  RAISE NOTICE '  - SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '';
  RAISE NOTICE 'Permissões:';
  RAISE NOTICE '- Apenas OWNERS podem gerenciar usuários';
  RAISE NOTICE '- Admins NÃO podem mais gerenciar (simplificado)';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '1. Testar convite de usuário';
  RAISE NOTICE '2. Testar cadastro de usuário';
  RAISE NOTICE '3. Verificar se não há mais erro de recursão';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
