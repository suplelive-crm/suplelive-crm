-- ============================================================================
-- MIGRAÇÃO: Adicionar Configurações Avançadas aos Templates Existentes
-- ============================================================================
-- Este script atualiza a tabela message_templates existente para adicionar
-- configurações de timing e filtros (send_config e filter_config)
-- ============================================================================
-- COMO EXECUTAR:
-- 1. Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
-- 2. Cole todo este script no editor SQL
-- 3. Clique em "RUN" no canto inferior direito
-- 4. Aguarde a confirmação "Success"
-- ============================================================================

-- PASSO 1: Adicionar colunas JSONB para configurações
-- ============================================================================
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS send_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '{}'::jsonb;

-- PASSO 2: Criar índices GIN para buscar dentro do JSONB
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_message_templates_send_config
  ON public.message_templates USING GIN (send_config);

CREATE INDEX IF NOT EXISTS idx_message_templates_filter_config
  ON public.message_templates USING GIN (filter_config);

-- PASSO 3: Atualizar função get_message_template para retornar configurações
-- ============================================================================
DROP FUNCTION IF EXISTS get_message_template(uuid, text);

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
    COALESCE(mt.send_config, '{}'::jsonb) as send_config,
    COALESCE(mt.filter_config, '{}'::jsonb) as filter_config
  FROM public.message_templates mt
  WHERE mt.workspace_id = p_workspace_id
    AND mt.template_type = p_template_type
    AND mt.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASSO 4: Criar função para calcular data de envio
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

-- PASSO 5: Atualizar templates existentes com configurações padrão
-- ============================================================================
UPDATE public.message_templates
SET
  send_config = CASE template_type
    WHEN 'welcome' THEN jsonb_build_object(
      'timing_type', 'immediate',
      'enabled', true
    )
    WHEN 'upsell' THEN jsonb_build_object(
      'timing_type', 'delayed',
      'delay_value', 5,
      'delay_unit', 'minutes',
      'enabled', true
    )
    WHEN 'reorder' THEN jsonb_build_object(
      'timing_type', 'before_end',
      'days_before_end', 15,
      'enabled', true
    )
  END,
  filter_config = CASE template_type
    WHEN 'welcome' THEN jsonb_build_object(
      'first_order_only', true,
      'exclude_channels', '[]'::jsonb
    )
    WHEN 'upsell' THEN jsonb_build_object(
      'exclude_channels', '["shop", "atacado", "whatsapp"]'::jsonb,
      'min_order_value', 0,
      'max_order_value', null
    )
    WHEN 'reorder' THEN jsonb_build_object(
      'exclude_channels', '[]'::jsonb,
      'only_with_duration', true,
      'min_order_value', 0
    )
  END
WHERE send_config = '{}'::jsonb OR send_config IS NULL;

-- PASSO 6: Atualizar comentários da tabela
-- ============================================================================
COMMENT ON TABLE public.message_templates IS 'Armazena templates personalizáveis para mensagens automáticas com configurações de envio e filtros';
COMMENT ON COLUMN public.message_templates.send_config IS 'Configurações de timing de envio: {timing_type: "immediate"|"delayed"|"before_end", delay_value, delay_unit, days_before_end, enabled}';
COMMENT ON COLUMN public.message_templates.filter_config IS 'Filtros de quando enviar: {exclude_channels, min_order_value, max_order_value, first_order_only, only_with_duration}';
COMMENT ON FUNCTION get_message_template IS 'Busca o template ativo, configurações de envio e filtros para um workspace e tipo';
COMMENT ON FUNCTION calculate_send_date IS 'Calcula a data/hora de envio baseado nas configurações e data do pedido';

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
-- Se tudo correu bem, você verá a mensagem "Success. No rows returned"
-- ============================================================================

-- VERIFICAÇÃO: Rode esta query para ver os templates atualizados
/*
SELECT
  template_type,
  LEFT(template_content, 40) as preview,
  send_config->>'timing_type' as timing,
  send_config->>'enabled' as habilitado,
  filter_config->'exclude_channels' as canais_excluidos
FROM message_templates
ORDER BY workspace_id, template_type;
*/

-- TESTES:
-- ============================================================================

-- Teste 1: Buscar template com configurações
/*
SELECT * FROM get_message_template(
  '[seu_workspace_id]'::uuid,
  'welcome'
);
*/

-- Teste 2: Calcular data de envio (5 minutos depois)
/*
SELECT calculate_send_date(
  NOW(),
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
);
*/

-- Teste 3: Calcular data de recompra (15 dias antes, produto 30 dias)
/*
SELECT calculate_send_date(
  '2025-01-01 10:00:00'::timestamptz,
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30
);
-- Resultado esperado: 2025-01-16 10:00:00
*/
