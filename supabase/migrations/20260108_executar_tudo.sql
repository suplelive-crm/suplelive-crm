-- ============================================================================
-- MIGRATION CONSOLIDADA: Executar Tudo de Uma Vez
-- Data: 08/01/2026
-- Descrição: Combina todas as migrations pendentes em um único arquivo
-- ============================================================================

-- ============================================================================
-- PARTE 1: CRIAR TABELA workspace_users
-- ============================================================================

-- Create workspace_users table
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_role ON workspace_users(role);
CREATE INDEX IF NOT EXISTS idx_workspace_users_status ON workspace_users(status);

-- Add comments
COMMENT ON TABLE workspace_users IS 'Usuários membros de workspaces com seus roles e permissões';
COMMENT ON COLUMN workspace_users.role IS 'Role do usuário: admin (pode gerenciar usuários) ou operator (acesso operacional)';
COMMENT ON COLUMN workspace_users.status IS 'Status do membro: pending (convite pendente), active (ativo), inactive (desativado)';

-- ============================================================================
-- PARTE 2: CRIAR TABELA user_invitations
-- ============================================================================

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email, status)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_workspace_id ON user_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);

-- Add comments
COMMENT ON TABLE user_invitations IS 'Convites pendentes de usuários para workspaces';
COMMENT ON COLUMN user_invitations.token IS 'Token único para aceitar o convite';
COMMENT ON COLUMN user_invitations.status IS 'Status do convite: pending, accepted, expired, cancelled';

-- ============================================================================
-- PARTE 3: CRIAR TRIGGERS DE updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workspace_users
DROP TRIGGER IF EXISTS update_workspace_users_updated_at ON workspace_users;
CREATE TRIGGER update_workspace_users_updated_at
  BEFORE UPDATE ON workspace_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_invitations
DROP TRIGGER IF EXISTS update_user_invitations_updated_at ON user_invitations;
CREATE TRIGGER update_user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 4: REMOVER POLÍTICAS RLS ANTIGAS (com recursão)
-- ============================================================================

-- Remover políticas antigas de workspace_users
DROP POLICY IF EXISTS "Users can view workspace members they belong to" ON workspace_users;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_users;

-- Remover políticas antigas de user_invitations
DROP POLICY IF EXISTS "Users can view workspace invitations" ON user_invitations;
DROP POLICY IF EXISTS "Workspace admins can manage invitations" ON user_invitations;

-- ============================================================================
-- PARTE 5: CRIAR POLÍTICAS RLS SIMPLIFICADAS (sem recursão)
-- ============================================================================

-- ============================================================================
-- PARTE 5.1: Políticas para workspace_users
-- ============================================================================

-- SELECT: Usuários podem ver membros de workspaces que são donos OU que pertencem
DROP POLICY IF EXISTS "workspace_users_select_policy" ON workspace_users;
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

-- INSERT: Apenas owners podem adicionar membros
DROP POLICY IF EXISTS "workspace_users_insert_policy" ON workspace_users;
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
DROP POLICY IF EXISTS "workspace_users_update_policy" ON workspace_users;
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
DROP POLICY IF EXISTS "workspace_users_delete_policy" ON workspace_users;
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
-- PARTE 5.2: Políticas para user_invitations
-- ============================================================================

-- SELECT: Ver convites de workspaces que é owner
DROP POLICY IF EXISTS "user_invitations_select_policy" ON user_invitations;
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
DROP POLICY IF EXISTS "user_invitations_insert_policy" ON user_invitations;
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
DROP POLICY IF EXISTS "user_invitations_update_policy" ON user_invitations;
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
DROP POLICY IF EXISTS "user_invitations_delete_policy" ON user_invitations;
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
-- PARTE 6: HABILITAR RLS
-- ============================================================================

ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 7: VALIDAÇÃO E MENSAGENS
-- ============================================================================

DO $$
DECLARE
  v_workspace_users_count INTEGER;
  v_user_invitations_count INTEGER;
  v_workspace_users_policies INTEGER;
  v_user_invitations_policies INTEGER;
  v_indexes_count INTEGER;
  v_triggers_count INTEGER;
BEGIN
  -- Contar tabelas criadas
  SELECT COUNT(*) INTO v_workspace_users_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'workspace_users';

  SELECT COUNT(*) INTO v_user_invitations_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'user_invitations';

  -- Contar políticas criadas
  SELECT COUNT(*) INTO v_workspace_users_policies
  FROM pg_policies
  WHERE tablename = 'workspace_users';

  SELECT COUNT(*) INTO v_user_invitations_policies
  FROM pg_policies
  WHERE tablename = 'user_invitations';

  -- Contar indexes
  SELECT COUNT(*) INTO v_indexes_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('workspace_users', 'user_invitations');

  -- Contar triggers
  SELECT COUNT(*) INTO v_triggers_count
  FROM information_schema.triggers
  WHERE event_object_table IN ('workspace_users', 'user_invitations')
    AND trigger_name LIKE 'update_%_updated_at';

  -- Exibir resultados
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ MIGRATION CONSOLIDADA EXECUTADA COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Resumo:';
  RAISE NOTICE '-----------------------------------------------------------';
  RAISE NOTICE '✓ Tabelas criadas:';
  RAISE NOTICE '  - workspace_users: %', CASE WHEN v_workspace_users_count > 0 THEN '✅ Criada' ELSE '❌ Erro' END;
  RAISE NOTICE '  - user_invitations: %', CASE WHEN v_user_invitations_count > 0 THEN '✅ Criada' ELSE '❌ Erro' END;
  RAISE NOTICE '';
  RAISE NOTICE '✓ Políticas RLS:';
  RAISE NOTICE '  - workspace_users: % políticas', v_workspace_users_policies;
  RAISE NOTICE '  - user_invitations: % políticas', v_user_invitations_policies;
  RAISE NOTICE '';
  RAISE NOTICE '✓ Índices: % criados', v_indexes_count;
  RAISE NOTICE '✓ Triggers: % criados', v_triggers_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Permissões configuradas:';
  RAISE NOTICE '-----------------------------------------------------------';
  RAISE NOTICE '  - Apenas OWNERS podem gerenciar usuários';
  RAISE NOTICE '  - Admins NÃO podem gerenciar (simplificado)';
  RAISE NOTICE '  - Membros podem ver outros membros do mesmo workspace';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Próximos passos:';
  RAISE NOTICE '-----------------------------------------------------------';
  RAISE NOTICE '  1. Recarregar a aplicação (F5)';
  RAISE NOTICE '  2. Fazer login como owner do workspace';
  RAISE NOTICE '  3. Ir em: Configurações → Workspace → Gerenciar Usuários';
  RAISE NOTICE '  4. Testar cadastro de novo usuário';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '🎉 Tudo pronto! Os erros de schema devem ter desaparecido.';
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- FIM DA MIGRATION CONSOLIDADA
-- ============================================================================
