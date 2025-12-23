/**
 * Message Templates Helper Functions
 *
 * This module provides helper functions to fetch and process message templates
 * from the database for use in automated messages.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Default templates as fallback
 */
const DEFAULT_TEMPLATES = {
  welcome: `Olá {{client_name}}! 👋

Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.

Qualquer dúvida, estou à disposição! 😊`,

  upsell: `Oi, {{client_name}}! Tudo bem? 😀

Confirmamos sua compra do {{product_name}} e tenho uma surpresa especial pra você:

✨ Leve mais 1 unidade com desconto exclusivo no Pix!

👉 Cada unidade adicional sai por R$ {{discounted_price}} no Pix.
📦 O envio vai junto com o seu pedido.
⏳ Oferta válida por 1 hora a partir do recebimento desta mensagem.

É só me responder "SIM" aqui mesmo que já adiciono pra você. 😉`,

  reorder: `Olá {{client_name}}!

O produto "{{product_name}}" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊`
};

/**
 * Get message template from database
 * Falls back to default template if not found
 */
export async function getMessageTemplate(
  supabase: SupabaseClient,
  workspaceId: string,
  templateType: 'welcome' | 'upsell' | 'reorder'
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('template_content')
      .eq('workspace_id', workspaceId)
      .eq('template_type', templateType)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching ${templateType} template:`, error);
      return DEFAULT_TEMPLATES[templateType];
    }

    if (!data) {
      console.log(`No custom ${templateType} template found, using default`);
      return DEFAULT_TEMPLATES[templateType];
    }

    return data.template_content;
  } catch (error) {
    console.error(`Exception fetching ${templateType} template:`, error);
    return DEFAULT_TEMPLATES[templateType];
  }
}

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value));
  }

  return result;
}

/**
 * Get and process welcome message template
 */
export async function getWelcomeMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  variables: {
    client_name: string;
    order_id?: string;
  }
): Promise<string> {
  const template = await getMessageTemplate(supabase, workspaceId, 'welcome');
  return replaceTemplateVariables(template, variables);
}

/**
 * Get and process upsell message template (segunda unidade com desconto)
 */
export async function getUpsellMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  variables: {
    client_name: string;
    product_name: string;
    original_price: string;
    discounted_price: string;
  }
): Promise<string> {
  const template = await getMessageTemplate(supabase, workspaceId, 'upsell');
  return replaceTemplateVariables(template, variables);
}

/**
 * Get and process reorder message template
 */
export async function getReorderMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  variables: {
    client_name: string;
    product_name: string;
    product_sku?: string;
    order_date?: string;
    duration_days?: number;
  }
): Promise<string> {
  const template = await getMessageTemplate(supabase, workspaceId, 'reorder');
  return replaceTemplateVariables(template, variables);
}

/**
 * Re-export WhatsApp sender function for convenience
 */
export { sendWhatsAppMessage } from './whatsapp-sender.ts';
