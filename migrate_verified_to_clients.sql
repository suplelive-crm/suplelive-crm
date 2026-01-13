-- ============================================================================
-- PLANO: Migrar campo "verified" de orders para clients
-- O campo "verified" indica se o número do WhatsApp do cliente está verificado
-- ============================================================================

-- PASSO 1: Verificar estrutura atual
-- ============================================================================

-- Ver estrutura da tabela orders
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
  AND column_name LIKE '%verif%'
ORDER BY ordinal_position;

-- Ver estrutura da tabela clients
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'clients'
  AND column_name LIKE '%verif%'
ORDER BY ordinal_position;

-- Ver quantos pedidos estão marcados como verificados
SELECT
  is_verified,
  COUNT(*) as total
FROM orders
GROUP BY is_verified;

-- PASSO 2: Adicionar campo phone_verified na tabela clients
-- ============================================================================

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

COMMENT ON COLUMN clients.phone_verified IS 'Indica se o número do WhatsApp do cliente foi verificado';

-- PASSO 3: Migrar dados - marcar cliente como verificado se tiver algum pedido verificado
-- ============================================================================

-- Atualizar clients baseado nos pedidos verificados
UPDATE clients c
SET phone_verified = true
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.client_id = c.id
    AND o.is_verified = true
);

-- Verificar resultado da migração
SELECT 
  'Clientes com telefone verificado' as label,
  COUNT(*) as total
FROM clients
WHERE phone_verified = true

UNION ALL

SELECT 
  'Total de clientes' as label,
  COUNT(*) as total
FROM clients;

-- PASSO 4: Verificar quais componentes usam order.verified
-- (Isso será feito no código frontend)

SELECT '✅ PASSO 1-3 COMPLETOS: Campo criado e dados migrados!' as status;
SELECT '⚠️ PRÓXIMO: Atualizar frontend antes de remover campo da tabela orders' as proxima_acao;
