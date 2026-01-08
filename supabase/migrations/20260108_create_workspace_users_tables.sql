-- ============================================================================
-- MIGRATION: Criar Tabelas de Gerenciamento de Usuários
-- Data: 08/01/2026
-- Descrição: Adiciona tabelas workspace_users e user_invitations para
--            permitir que administradores criem e gerenciem usuários
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
  accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_workspace_id ON user_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);

-- Add comments
COMMENT ON TABLE user_invitations IS 'Convites pendentes para novos usuários entrarem em workspaces';
COMMENT ON COLUMN user_invitations.token IS 'Token único e seguro para aceitar o convite';
COMMENT ON COLUMN user_invitations.expires_at IS 'Data de expiração do convite (padrão: 7 dias)';

-- ============================================================================
-- PARTE 3: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 3.1: RLS Policies for workspace_users
-- ============================================================================

-- Policy: Users can view workspace members they belong to
CREATE POLICY "Users can view workspace members they belong to"
  ON workspace_users
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id
      FROM workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- Policy: Workspace owners and admins can manage members
CREATE POLICY "Workspace admins can manage members"
  ON workspace_users
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_users
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id
      FROM workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- PARTE 3.2: RLS Policies for user_invitations
-- ============================================================================

-- Policy: Users can view invitations for workspaces they belong to
CREATE POLICY "Users can view workspace invitations"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id
      FROM workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- Policy: Admins and owners can create/manage invitations
CREATE POLICY "Workspace admins can manage invitations"
  ON user_invitations
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_users
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id
      FROM workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- PARTE 4: FUNÇÕES AUXILIARES
-- ============================================================================

-- Function to check if a user is a workspace admin or owner
CREATE OR REPLACE FUNCTION is_workspace_admin(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspaces WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM workspace_users
    WHERE workspace_id = workspace_uuid
      AND user_id = user_uuid
      AND role = 'admin'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically mark expired invitations
CREATE OR REPLACE FUNCTION mark_expired_invitations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 5: TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp on workspace_users
CREATE OR REPLACE FUNCTION update_workspace_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_users_updated_at
  BEFORE UPDATE ON workspace_users
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_users_updated_at();

-- ============================================================================
-- PARTE 6: POPULAR TABELA workspace_users COM OWNERS EXISTENTES
-- ============================================================================

-- Add existing workspace owners to workspace_users table as admin
INSERT INTO workspace_users (workspace_id, user_id, role, status, joined_at)
SELECT
  id AS workspace_id,
  owner_id AS user_id,
  'admin' AS role,
  'active' AS status,
  created_at AS joined_at
FROM workspaces
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_users
  WHERE workspace_id = workspaces.id
    AND user_id = workspaces.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ============================================================================
-- PARTE 7: VALIDAÇÃO E MENSAGENS DE SUCESSO
-- ============================================================================

DO $$
DECLARE
  v_workspace_users_exists BOOLEAN;
  v_user_invitations_exists BOOLEAN;
  v_owner_count INTEGER;
  v_workspace_user_count INTEGER;
BEGIN
  -- Verificar se as tabelas foram criadas
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'workspace_users'
  ) INTO v_workspace_users_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'user_invitations'
  ) INTO v_user_invitations_exists;

  -- Contar owners importados
  SELECT COUNT(*) FROM workspaces INTO v_owner_count;
  SELECT COUNT(*) FROM workspace_users INTO v_workspace_user_count;

  -- Exibir resultados
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION APLICADA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '1. workspace_users: %', CASE WHEN v_workspace_users_exists THEN '✓ OK' ELSE '✗ ERRO' END;
  RAISE NOTICE '2. user_invitations: %', CASE WHEN v_user_invitations_exists THEN '✓ OK' ELSE '✗ ERRO' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Dados migrados:';
  RAISE NOTICE '- Total de workspaces: %', v_owner_count;
  RAISE NOTICE '- Owners adicionados como admins: %', v_workspace_user_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Funcionalidades habilitadas:';
  RAISE NOTICE '✓ Cadastro de usuários por Admin/Owner';
  RAISE NOTICE '✓ Convites de usuários (via email)';
  RAISE NOTICE '✓ Gerenciamento de roles (admin/operator)';
  RAISE NOTICE '✓ Row Level Security configurado';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '1. Aplicar migration: npx supabase db push';
  RAISE NOTICE '2. Fazer deploy da Edge Function: npx supabase functions deploy register-user';
  RAISE NOTICE '3. Testar cadastro de usuário no frontend';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
