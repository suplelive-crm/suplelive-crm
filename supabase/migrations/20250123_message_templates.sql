-- Migration: Message Templates Table
-- Description: Store customizable message templates for automated messages
-- Date: 2025-01-23

-- Create message_templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('welcome', 'upsell', 'reorder')),
  template_content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT message_templates_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id)
    ON DELETE CASCADE,

  -- Unique constraint: one active template per type per workspace
  CONSTRAINT message_templates_workspace_type_unique
    UNIQUE (workspace_id, template_type, is_active)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_workspace_id
  ON public.message_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_type
  ON public.message_templates(template_type);

CREATE INDEX IF NOT EXISTS idx_message_templates_active
  ON public.message_templates(is_active)
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Function to get active template for a workspace
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

-- Function to replace variables in template
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

  -- Loop through all variables and replace them
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_result := REPLACE(v_result, '{{' || v_key || '}}', v_value);
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Insert default templates for existing workspaces
DO $$
DECLARE
  v_workspace RECORD;
BEGIN
  FOR v_workspace IN SELECT id FROM public.workspaces
  LOOP
    -- Welcome template
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

    -- Upsell template
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

    -- Reorder template
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

-- Comments
COMMENT ON TABLE public.message_templates IS 'Stores customizable message templates for automated messages (welcome, upsell, reorder)';
COMMENT ON COLUMN public.message_templates.template_type IS 'Type of message: welcome (new customer), upsell (cross-sell), reorder (repurchase reminder)';
COMMENT ON COLUMN public.message_templates.template_content IS 'Message template with variables in {{variable}} format';
COMMENT ON COLUMN public.message_templates.variables IS 'Array of available variables for this template';
COMMENT ON FUNCTION get_message_template IS 'Get active template content for a workspace and type';
COMMENT ON FUNCTION replace_template_variables IS 'Replace all {{variable}} placeholders with actual values from JSONB';
