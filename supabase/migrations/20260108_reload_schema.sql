-- ============================================================================
-- MIGRATION: Recarregar Schema Cache do PostgREST
-- Data: 08/01/2026
-- Descrição: Força o Supabase a recarregar o schema cache para reconhecer
--            os novos relacionamentos das tabelas workspace_users e user_invitations
-- ============================================================================

-- Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificar que as tabelas existem
DO $$
DECLARE
  v_workspace_users_exists BOOLEAN;
  v_user_invitations_exists BOOLEAN;
  v_fk_user_id BOOLEAN;
  v_fk_invited_by BOOLEAN;
BEGIN
  -- Verificar se tabelas existem
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'workspace_users'
  ) INTO v_workspace_users_exists;

  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_invitations'
  ) INTO v_user_invitations_exists;

  -- Verificar foreign keys
  SELECT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_name = 'workspace_users'
    AND constraint_name LIKE '%user_id%'
  ) INTO v_fk_user_id;

  SELECT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_name = 'user_invitations'
    AND constraint_name LIKE '%invited_by%'
  ) INTO v_fk_invited_by;

  -- Exibir status
  RAISE NOTICE '============================================================';
  RAISE NOTICE '📊 VERIFICAÇÃO DE SCHEMA';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas:';
  RAISE NOTICE '  workspace_users: %', CASE WHEN v_workspace_users_exists THEN '✅ Existe' ELSE '❌ Não encontrada' END;
  RAISE NOTICE '  user_invitations: %', CASE WHEN v_user_invitations_exists THEN '✅ Existe' ELSE '❌ Não encontrada' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Foreign Keys:';
  RAISE NOTICE '  workspace_users.user_id → auth.users: %', CASE WHEN v_fk_user_id THEN '✅ OK' ELSE '❌ Não encontrada' END;
  RAISE NOTICE '  user_invitations.invited_by → auth.users: %', CASE WHEN v_fk_invited_by THEN '✅ OK' ELSE '❌ Não encontrada' END;
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Schema cache recarregado!';
  RAISE NOTICE '';
  RAISE NOTICE 'Aguarde 5-10 segundos e recarregue a aplicação (F5)';
  RAISE NOTICE '============================================================';
END $$;
