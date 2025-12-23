-- ============================================================================
-- SCRIPT PARA CRIAR TABELA DE TEMPLATES DE MENSAGENS
-- ============================================================================
-- COMO EXECUTAR:
-- 1. Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
-- 2. Cole todo este script no editor SQL
-- 3. Clique em "RUN" no canto inferior direito
-- 4. Aguarde a confirmação "Success"
-- ============================================================================

-- PASSO 1: Criar a tabela message_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('welcome', 'upsell', 'reorder')),
  template_content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
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

-- PASSO 3: Ativar Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- PASSO 4: Criar políticas RLS
-- ============================================================================

-- Permitir usuários verem templates do seu workspace
DROP POLICY IF EXISTS "Users can view templates from their workspace" ON public.message_templates;
CREATE POLICY "Users can view templates from their workspace"
  ON public.message_templates
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- Permitir usuários criarem templates no seu workspace
DROP POLICY IF EXISTS "Users can insert templates in their workspace" ON public.message_templates;
CREATE POLICY "Users can insert templates in their workspace"
  ON public.message_templates
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- Permitir usuários atualizarem templates do seu workspace
DROP POLICY IF EXISTS "Users can update templates in their workspace" ON public.message_templates;
CREATE POLICY "Users can update templates in their workspace"
  ON public.message_templates
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- Permitir usuários deletarem templates do seu workspace
DROP POLICY IF EXISTS "Users can delete templates in their workspace" ON public.message_templates;
CREATE POLICY "Users can delete templates in their workspace"
  ON public.message_templates
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- PASSO 5: Criar função para buscar template
-- ============================================================================
CREATE OR REPLACE FUNCTION get_message_template(
  p_workspace_id UUID,
  p_template_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_template_content TEXT;
BEGIN
  SELECT template_content INTO v_template_content
  FROM public.message_templates
  WHERE workspace_id = p_workspace_id
    AND template_type = p_template_type
    AND is_active = true
  LIMIT 1;

  RETURN v_template_content;
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

-- PASSO 7: Inserir templates padrão para todos os workspaces existentes
-- ============================================================================
DO $$
DECLARE
  v_workspace RECORD;
BEGIN
  FOR v_workspace IN SELECT id FROM public.workspaces
  LOOP
    -- Template de Boas-Vindas
    INSERT INTO public.message_templates (
      workspace_id,
      template_type,
      template_content,
      variables,
      is_active
    ) VALUES (
      v_workspace.id,
      'welcome',
      E'Olá {{client_name}}! 👋\n\nObrigado por escolher nossa loja!\nSeu pedido foi recebido e já estamos processando.\n\nQualquer dúvida, estou à disposição! 😊',
      ARRAY['client_name', 'order_id'],
      true
    ) ON CONFLICT (workspace_id, template_type, is_active) DO NOTHING;

    -- Template de Venda Casada
    INSERT INTO public.message_templates (
      workspace_id,
      template_type,
      template_content,
      variables,
      is_active
    ) VALUES (
      v_workspace.id,
      'upsell',
      E'Olá {{client_name}}! 🎉\n\nObrigado pelo seu pedido!\n\nClientes que compraram os mesmos produtos também gostaram de:\n\n{{product_list}}\n\nQuer aproveitar? Posso adicionar ao seu pedido! 😊',
      ARRAY['client_name', 'order_id', 'product_list', 'order_total'],
      true
    ) ON CONFLICT (workspace_id, template_type, is_active) DO NOTHING;

    -- Template de Recompra
    INSERT INTO public.message_templates (
      workspace_id,
      template_type,
      template_content,
      variables,
      is_active
    ) VALUES (
      v_workspace.id,
      'reorder',
      E'Olá {{client_name}}!\n\nO produto "{{product_name}}" que você comprou está acabando! 🏁\n\nQuer fazer uma nova compra para não ficar sem? 🛒\n\nÉ só me chamar! 😊',
      ARRAY['client_name', 'product_name', 'product_sku', 'order_date', 'duration_days'],
      true
    ) ON CONFLICT (workspace_id, template_type, is_active) DO NOTHING;
  END LOOP;
END $$;

-- PASSO 8: Adicionar comentários (documentação)
-- ============================================================================
COMMENT ON TABLE public.message_templates IS 'Armazena templates personalizáveis para mensagens automáticas (boas-vindas, venda casada, recompra)';
COMMENT ON COLUMN public.message_templates.template_type IS 'Tipo de mensagem: welcome (novo cliente), upsell (venda casada), reorder (lembrete de recompra)';
COMMENT ON COLUMN public.message_templates.template_content IS 'Template da mensagem com variáveis no formato {{variavel}}';
COMMENT ON COLUMN public.message_templates.variables IS 'Array de variáveis disponíveis para este template';
COMMENT ON FUNCTION get_message_template IS 'Busca o conteúdo do template ativo para um workspace e tipo';
COMMENT ON FUNCTION replace_template_variables IS 'Substitui todos os placeholders {{variavel}} com valores reais do JSONB';

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Se tudo correu bem, você verá a mensagem "Success. No rows returned"
-- ============================================================================

-- VERIFICAÇÃO: Rode esta query para ver os templates criados
-- SELECT * FROM message_templates ORDER BY workspace_id, template_type;
