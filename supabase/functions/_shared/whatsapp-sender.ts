import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Evolution API Client
 * Simplified version for Edge Functions
 */
class EvolutionAPI {
  private baseURL = 'https://evolution.suplelive.com.br';
  private apiKey = '14793ff820dfc1ea9421e24722628426';

  async sendSimpleTextMessage(instance: string, number: string, text: string) {
    const response = await fetch(`${this.baseURL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      },
      body: JSON.stringify({
        number,
        text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}

/**
 * Busca primeira instância WhatsApp conectada do workspace
 */
async function getConnectedInstance(
  supabase: SupabaseClient,
  workspaceId: string
) {
  const { data: instances, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar instância WhatsApp:', error);
    throw new Error(`Erro ao buscar instância WhatsApp: ${error.message}`);
  }

  if (!instances || instances.length === 0) {
    throw new Error('Nenhuma instância WhatsApp conectada para este workspace');
  }

  return instances[0];
}

/**
 * Formata número de telefone para WhatsApp
 * Adiciona código do país (55) e sufixo @s.whatsapp.net
 */
function formatPhoneNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');

  // Se já tem 13 dígitos e começa com 55, usa direto
  if (digits.length === 13 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  }

  // Se tem 11 dígitos e começa com 55, usa direto
  if (digits.length === 11 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  }

  // Se tem 11 dígitos sem código de país, adiciona 55
  if (digits.length === 11) {
    return `55${digits}@s.whatsapp.net`;
  }

  // Se tem 10 dígitos (número sem o 9), adiciona 55 e 9
  if (digits.length === 10) {
    return `559${digits}@s.whatsapp.net`;
  }

  // Caso padrão: usa o que vier
  return `${digits}@s.whatsapp.net`;
}

/**
 * Envia mensagem WhatsApp via Evolution API
 *
 * @param supabase - Cliente Supabase
 * @param workspaceId - ID do workspace
 * @param clientPhone - Número de telefone do cliente
 * @param messageContent - Conteúdo da mensagem a ser enviada
 * @throws Error se não houver instância conectada ou se falhar ao enviar
 */
export async function sendWhatsAppMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  clientPhone: string,
  messageContent: string
): Promise<void> {
  // 1. Validar telefone
  if (!clientPhone) {
    throw new Error('Cliente não possui número de telefone');
  }

  // 2. Buscar instância conectada
  const instance = await getConnectedInstance(supabase, workspaceId);

  if (!instance.session_id) {
    throw new Error('Instância não possui session_id');
  }

  // 3. Formatar número
  const formattedNumber = formatPhoneNumber(clientPhone);

  console.log(`Enviando mensagem WhatsApp:`, {
    workspace: workspaceId,
    instance: instance.session_id,
    phone: clientPhone,
    formattedNumber,
    messagePreview: messageContent.substring(0, 50) + '...'
  });

  // 4. Enviar via Evolution API
  const evolutionAPI = new EvolutionAPI();

  try {
    await evolutionAPI.sendSimpleTextMessage(
      instance.session_id,
      formattedNumber,
      messageContent
    );

    console.log(`✅ Mensagem enviada com sucesso para ${formattedNumber}`);
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
    throw new Error(`Falha ao enviar WhatsApp: ${error.message}`);
  }
}
