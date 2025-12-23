-- ============================================================================
-- SCRIPT PARA CRIAR TABELA DE TEMPLATES DE MENSAGENS COM CONFIGURAÇÕES DE ENVIO
-- ============================================================================
-- COMO EXECUTAR:
-- 1. Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
-- 2. Cole todo este script no editor SQL
-- 3. Clique em "RUN" no canto inferior direito
-- 4. Aguarde a confirmação "Success"
-- ============================================================================

-- PASSO 1: Criar a tabela message_templates com configurações de envio
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('welcome', 'upsell', 'reorder')),
  template_content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,

  -- Configurações de envio (JSONB flexível)
  send_config JSONB DEFAULT '{}'::jsonb,

  -- Configurações de filtro (quais pedidos enviar)
  filter_config JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key para workspaces
  CONSTRAINT message_templates_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id)
    ON DELETE CASCADE,

  -- Garantir apenas um template ativo por tipo por workspace
  CONSTRAINT message_templates_workspace_type_unique
    UNIQUE (workspace_id, template_type, is_active)
);

-- PASSO 2: Criar índices para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_message_templates_workspace_id
  ON public.message_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_type
  ON public.message_templates(template_type);

CREATE INDEX IF NOT EXISTS idx_message_templates_active
  ON public.message_templates(is_active)
  WHERE is_active = true;

-- Índice GIN para buscar dentro do JSONB
CREATE INDEX IF NOT EXISTS idx_message_templates_send_config
  ON public.message_templates USING GIN (send_config);

CREATE INDEX IF NOT EXISTS idx_message_templates_filter_config
  ON public.message_templates USING GIN (filter_config);

-- PASSO 3: Ativar Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- PASSO 4: Criar políticas RLS (usando workspaces.owner_id)
-- ============================================================================

-- Permitir usuários verem templates dos workspaces que possuem
DROP POLICY IF EXISTS "Users can view templates from their workspace" ON public.message_templates;
CREATE POLICY "Users can view templates from their workspace"
  ON public.message_templates
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id
      FROM public.workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- Permitir usuários criarem templates nos workspaces que possuem
DROP POLICY IF EXISTS "Users can insert templates in their workspace" ON public.message_templates;
CREATE POLICY "Users can insert templates in their workspace"
  ON public.message_templates
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id
      FROM public.workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- Permitir usuários atualizarem templates dos workspaces que possuem
DROP POLICY IF EXISTS "Users can update templates in their workspace" ON public.message_templates;
CREATE POLICY "Users can update templates in their workspace"
  ON public.message_templates
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id
      FROM public.workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- Permitir usuários deletarem templates dos workspaces que possuem
DROP POLICY IF EXISTS "Users can delete templates in their workspace" ON public.message_templates;
CREATE POLICY "Users can delete templates in their workspace"
  ON public.message_templates
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT id
      FROM public.workspaces
      WHERE owner_id = auth.uid()
    )
  );

-- PASSO 5: Criar função para buscar template
-- ============================================================================
CREATE OR REPLACE FUNCTION get_message_template(
  p_workspace_id UUID,
  p_template_type TEXT
) RETURNS TABLE (
  template_content TEXT,
  send_config JSONB,
  filter_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.template_content,
    mt.send_config,
    mt.filter_config
  FROM public.message_templates mt
  WHERE mt.workspace_id = p_workspace_id
    AND mt.template_type = p_template_type
    AND mt.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASSO 6: Criar função para substituir variáveis
-- ============================================================================
CREATE OR REPLACE FUNCTION replace_template_variables(
  p_template TEXT,
  p_variables JSONB
) RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
  v_key TEXT;
  v_value TEXT;
BEGIN
  v_result := p_template;

  -- Loop através de todas as variáveis e substituir
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_result := REPLACE(v_result, '{{' || v_key || '}}', v_value);
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASSO 7: Criar função para calcular data de envio
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_send_date(
  p_order_date TIMESTAMPTZ,
  p_send_config JSONB,
  p_product_duration_days INTEGER DEFAULT NULL
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_timing_type TEXT;
  v_delay_value INTEGER;
  v_delay_unit TEXT;
  v_days_before_end INTEGER;
  v_send_date TIMESTAMPTZ;
BEGIN
  -- Extrair configuração de timing
  v_timing_type := p_send_config->>'timing_type'; -- 'immediate', 'delayed', 'before_end'

  CASE v_timing_type
    -- Envio imediato
    WHEN 'immediate' THEN
      v_send_date := NOW();

    -- Envio com delay após a compra
    WHEN 'delayed' THEN
      v_delay_value := (p_send_config->>'delay_value')::INTEGER;
      v_delay_unit := p_send_config->>'delay_unit'; -- 'minutes', 'hours', 'days'

      CASE v_delay_unit
        WHEN 'minutes' THEN
          v_send_date := p_order_date + (v_delay_value || ' minutes')::INTERVAL;
        WHEN 'hours' THEN
          v_send_date := p_order_date + (v_delay_value || ' hours')::INTERVAL;
        WHEN 'days' THEN
          v_send_date := p_order_date + (v_delay_value || ' days')::INTERVAL;
        ELSE
          v_send_date := p_order_date;
      END CASE;

    -- Envio X dias antes do fim da duração do produto
    WHEN 'before_end' THEN
      IF p_product_duration_days IS NULL THEN
        -- Se não tem duração, envia em 30 dias
        v_send_date := p_order_date + INTERVAL '30 days';
      ELSE
        v_days_before_end := (p_send_config->>'days_before_end')::INTEGER;
        v_send_date := p_order_date + (p_product_duration_days - v_days_before_end || ' days')::INTERVAL;
      END IF;

    ELSE
      -- Default: imediato
      v_send_date := NOW();
  END CASE;

  RETURN v_send_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASSO 8: Inserir templates padrão com configurações para todos os workspaces
-- ============================================================================
DO $$
DECLARE
  v_workspace RECORD;
BEGIN
  FOR v_workspace IN SELECT id FROM public.workspaces
  LOOP
    -- Template de Boas-Vindas (envio imediato)
    INSERT INTO public.message_templates (
      workspace_id,
      template_type,
      template_content,
      variables,
      is_active,
      send_config,
      filter_config
    ) VALUES (
      v_workspace.id,
      'welcome',
      E'Olá {{client_name}}! 👋\n\nObrigado por escolher nossa loja!\nSeu pedido foi recebido e já estamos processando.\n\nQualquer dúvida, estou à disposição! 😊',
      ARRAY['client_name', 'order_id'],
      true,
      jsonb_build_object(
        'timing_type', 'immediate',
        'enabled', true
      ),
      jsonb_build_object(
        'first_order_only', true,
        'exclude_channels', ARRAY[]::TEXT[]
      )
    ) ON CONFLICT (workspace_id, template_type, is_active) DO NOTHING;

    -- Template de Venda Casada (envio após X minutos, canais específicos)
    INSERT INTO public.message_templates (
      workspace_id,
      template_type,
      template_content,
      variables,
      is_active,
      send_config,
      filter_config
    ) VALUES (
      v_workspace.id,
      'upsell',
      E'Oi, {{client_name}}! Tudo bem? 😀\n\nConfirmamos sua compra do {{product_name}} e tenho uma surpresa especial pra você:\n\n✨ Leve mais 1 unidade com desconto exclusivo no Pix!\n\n👉 Cada unidade adicional sai por R$ {{discounted_price}} no Pix.\n📦 O envio vai junto com o seu pedido.\n⏳ Oferta válida por 1 hora a partir do recebimento desta mensagem.\n\nÉ só me responder "SIM" aqui mesmo que já adiciono pra você. 😉',
      ARRAY['client_name', 'product_name', 'original_price', 'discounted_price'],
      true,
      jsonb_build_object(
        'timing_type', 'delayed',
        'delay_value', 5,
        'delay_unit', 'minutes',
        'enabled', true
      ),
      jsonb_build_object(
        'exclude_channels', ARRAY['shop', 'atacado', 'whatsapp'],
        'min_order_value', 0,
        'max_order_value', NULL
      )
    ) ON CONFLICT (workspace_id, template_type, is_active) DO NOTHING;

    -- Template de Recompra (envio 15 dias antes do fim da duração)
    INSERT INTO public.message_templates (
      workspace_id,
      template_type,
      template_content,
      variables,
      is_active,
      send_config,
      filter_config
    ) VALUES (
      v_workspace.id,
      'reorder',
      E'Olá {{client_name}}!\n\nO produto "{{product_name}}" que você comprou está acabando! 🏁\n\nQuer fazer uma nova compra para não ficar sem? 🛒\n\nÉ só me chamar! 😊',
      ARRAY['client_name', 'product_name', 'product_sku', 'order_date', 'duration_days'],
      true,
      jsonb_build_object(
        'timing_type', 'before_end',
        'days_before_end', 15,
        'enabled', true
      ),
      jsonb_build_object(
        'exclude_channels', ARRAY[]::TEXT[],
        'min_order_value', 0,
        'only_with_duration', true
      )
    ) ON CONFLICT (workspace_id, template_type, is_active) DO NOTHING;
  END LOOP;
END $$;

-- PASSO 9: Adicionar comentários (documentação)
-- ============================================================================
COMMENT ON TABLE public.message_templates IS 'Armazena templates personalizáveis para mensagens automáticas com configurações de envio';
COMMENT ON COLUMN public.message_templates.template_type IS 'Tipo de mensagem: welcome (novo cliente), upsell (segunda unidade com desconto), reorder (lembrete de recompra)';
COMMENT ON COLUMN public.message_templates.template_content IS 'Template da mensagem com variáveis no formato {{variavel}}';
COMMENT ON COLUMN public.message_templates.variables IS 'Array de variáveis disponíveis para este template';
COMMENT ON COLUMN public.message_templates.send_config IS 'Configurações de timing de envio: {timing_type: "immediate"|"delayed"|"before_end", delay_value, delay_unit, days_before_end}';
COMMENT ON COLUMN public.message_templates.filter_config IS 'Filtros de quando enviar: {exclude_channels, min_order_value, max_order_value, first_order_only, only_with_duration}';
COMMENT ON FUNCTION get_message_template IS 'Busca o template ativo, configurações de envio e filtros para um workspace e tipo';
COMMENT ON FUNCTION replace_template_variables IS 'Substitui todos os placeholders {{variavel}} com valores reais do JSONB';
COMMENT ON FUNCTION calculate_send_date IS 'Calcula a data/hora de envio baseado nas configurações e data do pedido';

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Se tudo correu bem, você verá a mensagem "Success. No rows returned"
-- ============================================================================

-- VERIFICAÇÃO: Rode esta query para ver os templates criados com configurações
/*
SELECT
  template_type,
  LEFT(template_content, 50) as preview,
  send_config->>'timing_type' as timing,
  send_config,
  filter_config
FROM message_templates
ORDER BY workspace_id, template_type;
*/

-- EXEMPLOS DE USO:
-- ============================================================================

-- Exemplo 1: Buscar template com configurações
/*
SELECT * FROM get_message_template(
  '[workspace_id]',
  'welcome'
);
*/

-- Exemplo 2: Calcular quando enviar mensagem de upsell (5 minutos após pedido)
/*
SELECT calculate_send_date(
  NOW(), -- data do pedido
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
);
*/

-- Exemplo 3: Calcular quando enviar recompra (15 dias antes de acabar produto de 30 dias)
/*
SELECT calculate_send_date(
  '2025-01-01 10:00:00'::timestamptz, -- data do pedido
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30 -- duração do produto em dias
);
-- Resultado: 2025-01-16 10:00:00 (30 dias - 15 dias = dia 16)
*/
