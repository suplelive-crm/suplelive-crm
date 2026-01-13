-- ============================================================================
-- CORREÇÃO: RLS Policies baseadas em WORKSPACE ao invés de USER
-- ============================================================================

-- OPÇÃO 1: DESABILITAR RLS (mais rápido para testar)
-- Descomente para testar:
-- ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE products DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE returns DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;

-- OPÇÃO 2: RECRIAR POLÍTICAS CORRETAS (recomendado)

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view clients in their workspace" ON clients;
DROP POLICY IF EXISTS "Users can insert clients in their workspace" ON clients;
DROP POLICY IF EXISTS "Users can update clients in their workspace" ON clients;
DROP POLICY IF EXISTS "Users can delete clients in their workspace" ON clients;

-- Policy: Usuários podem ver clientes do workspace deles
CREATE POLICY "Users can view clients in their workspace" ON clients
FOR SELECT
USING (
  workspace_id IN (
    -- Workspaces onde o usuário é owner
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    -- Workspaces onde o usuário é membro ativo
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Policy: Usuários podem inserir clientes no workspace deles
CREATE POLICY "Users can insert clients in their workspace" ON clients
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Policy: Usuários podem atualizar clientes do workspace deles
CREATE POLICY "Users can update clients in their workspace" ON clients
FOR UPDATE
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Policy: Usuários podem deletar clientes do workspace deles
CREATE POLICY "Users can delete clients in their workspace" ON clients
FOR DELETE
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view orders in their workspace" ON orders;
DROP POLICY IF EXISTS "Users can insert orders in their workspace" ON orders;
DROP POLICY IF EXISTS "Users can update orders in their workspace" ON orders;

-- Orders não tem workspace_id direto, precisa fazer JOIN com clients
CREATE POLICY "Users can view orders in their workspace" ON orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = orders.client_id
    AND c.workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY "Users can insert orders in their workspace" ON orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = orders.client_id
    AND c.workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY "Users can update orders in their workspace" ON orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = orders.client_id
    AND c.workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view products in their workspace" ON products;
DROP POLICY IF EXISTS "Users can manage products in their workspace" ON products;

CREATE POLICY "Users can view products in their workspace" ON products
FOR SELECT
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can manage products in their workspace" ON products
FOR ALL
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

SELECT '✅ Políticas RLS corrigidas! Agora todos os membros do workspace veem os mesmos dados.' as status;
