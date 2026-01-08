// ============================================================================
// CONSOLIDATED VERSION FOR MANUAL DEPLOYMENT VIA SUPABASE DASHBOARD
// ============================================================================
// This file consolidates all dependencies into a single file for easy deployment
// Original modular version is in index.ts + validate-client-data.ts + _shared/*

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// BASELINKER API HELPERS
// ============================================================================

const BASELINKER_API_URL = 'https://api.baselinker.com/connector.php';

interface BaselinkerConfig {
  token: string;
  workspace_id?: string;
}

interface BaselinkerResponse<T = any> {
  status: 'SUCCESS' | 'ERROR';
  error_code?: string;
  error_message?: string;
  [key: string]: any;
}

interface BaselinkerOrder {
  order_id: number;
  order_status_name?: string;
  date_add: number;
  phone: string;
  email: string;
  delivery_fullname: string;
  invoice_fullname: string;
  invoice_nip: string;
  extra_field_1: string;
  extra_field_2: string;
  buyer_company: string;
  order_source: string;
  order_total_price_brutto: number;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_postcode: string;
  payment_method: string;
  delivery_method: string;
  delivery_price: number;
  products: BaselinkerProduct[];
  [key: string]: any;
}

interface BaselinkerProduct {
  order_product_id: number;
  storage_id: string;
  product_id: string;
  variant_id: string;
  name: string;
  sku: string;
  ean: string;
  price_brutto: number;
  tax_rate: number;
  quantity: number;
  [key: string]: any;
}

async function baselinkerRequest<T = any>(
  config: BaselinkerConfig,
  method: string,
  parameters: Record<string, any> = {}
): Promise<T> {
  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(parameters),
  });

  const response = await fetch(BASELINKER_API_URL, {
    method: 'POST',
    headers: {
      'X-BLToken': config.token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Baselinker API error: ${response.status} ${response.statusText}`);
  }

  const data: BaselinkerResponse<T> = await response.json();

  if (data.status === 'ERROR') {
    throw new Error(`Baselinker error: ${data.error_message} (${data.error_code})`);
  }

  return data as T;
}

async function fetchOrderDetails(
  config: BaselinkerConfig,
  orderId: number
): Promise<BaselinkerOrder | null> {
  const response = await baselinkerRequest<{ orders: BaselinkerOrder[] }>(
    config,
    'getOrders',
    { order_id: orderId }
  );
  return response.orders?.[0] || null;
}

// ============================================================================
// WORKSPACE CONFIG HELPERS
// ============================================================================

async function getBaselinkerToken(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch workspace config: ${error?.message}`);
  }

  const baselinkerToken = data.settings?.baselinker?.token;
  if (!baselinkerToken) {
    throw new Error(`Baselinker token not configured for workspace ${workspaceId}`);
  }

  return baselinkerToken;
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

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

async function getMessageTemplate(
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

    if (error || !data) {
      return DEFAULT_TEMPLATES[templateType];
    }

    return data.template_content;
  } catch (error) {
    return DEFAULT_TEMPLATES[templateType];
  }
}

function replaceTemplateVariables(
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

async function getWelcomeMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  variables: { client_name: string; order_id?: string }
): Promise<string> {
  const template = await getMessageTemplate(supabase, workspaceId, 'welcome');
  return replaceTemplateVariables(template, variables);
}

async function getUpsellMessage(
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

async function getReorderMessage(
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

// ============================================================================
// WHATSAPP SENDER
// ============================================================================

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
      body: JSON.stringify({ number, text })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}

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

  if (error || !instances || instances.length === 0) {
    throw new Error('Nenhuma instância WhatsApp conectada');
  }

  return instances[0];
}

function formatPhoneNumberForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  }

  if (digits.length === 11 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  }

  if (digits.length === 11) {
    return `55${digits}@s.whatsapp.net`;
  }

  if (digits.length === 10) {
    return `559${digits}@s.whatsapp.net`;
  }

  return `${digits}@s.whatsapp.net`;
}

async function sendWhatsAppMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  clientPhone: string,
  messageContent: string
): Promise<void> {
  if (!clientPhone) {
    throw new Error('Cliente não possui número de telefone');
  }

  const instance = await getConnectedInstance(supabase, workspaceId);
  if (!instance.session_id) {
    throw new Error('Instância não possui session_id');
  }

  const formattedNumber = formatPhoneNumberForWhatsApp(clientPhone);
  console.log(`Enviando mensagem WhatsApp para ${formattedNumber}`);

  const evolutionAPI = new EvolutionAPI();
  await evolutionAPI.sendSimpleTextMessage(
    instance.session_id,
    formattedNumber,
    messageContent
  );

  console.log(`✅ Mensagem enviada com sucesso`);
}

// ============================================================================
// PHONE VALIDATION (GhostAPI + WhatsApp)
// ============================================================================

interface GhostAPIPhone {
  numero: string;
  tipo?: string;
  whatsapp?: boolean;
}

interface GhostAPIResponse {
  success: boolean;
  data?: {
    telefones?: GhostAPIPhone[];
    nome?: string;
    cpf?: string;
  };
}

interface WhatsAppValidation {
  exists: boolean;
  name?: string;
  phone: string;
  verified: boolean;
  nameSimilarity?: number;
}

function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  };

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 100;

  // Levenshtein Distance
  const matrix: number[][] = [];
  const len1 = n1.length;
  const len2 = n2.length;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (n1.charAt(i - 1) === n2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

async function searchPhonesByGhostAPI(
  cpf: string,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<GhostAPIPhone[]> {
  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    const ghostConfig = workspace?.settings?.ghost_api;

    if (!ghostConfig?.api_key || !ghostConfig?.base_url) {
      console.log('GhostAPI não configurado');
      return [];
    }

    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) {
      console.log('CPF inválido:', cpf);
      return [];
    }

    const ghostUrl = `${ghostConfig.base_url}/consulta/cpf`;
    console.log('Consultando GhostAPI para CPF:', cleanCPF);

    const response = await fetch(ghostUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ghostConfig.api_key}`,
      },
      body: JSON.stringify({ cpf: cleanCPF })
    });

    if (!response.ok) {
      console.error('GhostAPI error:', response.status);
      return [];
    }

    const result: GhostAPIResponse = await response.json();

    if (!result.success || !result.data?.telefones) {
      console.log('GhostAPI não retornou telefones');
      return [];
    }

    console.log(`GhostAPI retornou ${result.data.telefones.length} telefone(s)`);
    return result.data.telefones;

  } catch (error) {
    console.error('Erro ao buscar telefones no GhostAPI:', error);
    return [];
  }
}

async function validateWhatsAppNumber(
  phone: string,
  instanceId: string,
  expectedName: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<WhatsAppValidation> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length < 12 || cleanPhone.length > 13) {
      console.log('Telefone inválido (formato):', phone);
      return { exists: false, phone: cleanPhone, verified: false };
    }

    const phoneWithCountry = cleanPhone.startsWith('55')
      ? cleanPhone
      : `55${cleanPhone}`;

    console.log('Validando telefone no WhatsApp:', phoneWithCountry);

    const functionUrl = `${supabaseUrl}/functions/v1/validate-whatsapp-number`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        phone: phoneWithCountry,
        instanceId: instanceId,
      })
    });

    if (!response.ok) {
      console.error('Erro ao validar WhatsApp:', await response.text());
      return { exists: false, phone: phoneWithCountry, verified: false };
    }

    const validation: WhatsAppValidation = await response.json();

    if (validation.exists && validation.name) {
      validation.nameSimilarity = calculateNameSimilarity(
        expectedName,
        validation.name
      );

      console.log(`Similaridade de nome: ${validation.nameSimilarity}%`);
    }

    return validation;

  } catch (error) {
    console.error('Erro ao validar telefone:', error);
    return { exists: false, phone: phone, verified: false };
  }
}

async function validateAndFindBestPhone(
  cpf: string,
  customerName: string,
  workspaceId: string,
  whatsappInstanceId: string,
  supabase: SupabaseClient
): Promise<string | null> {

  console.log(`\n=== Iniciando validação de telefone ===`);
  console.log(`CPF: ${cpf}`);
  console.log(`Nome esperado: ${customerName}`);

  const ghostPhones = await searchPhonesByGhostAPI(cpf, workspaceId, supabase);

  if (ghostPhones.length === 0) {
    console.log('GhostAPI não retornou telefones');
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const validations: WhatsAppValidation[] = [];

  for (const ghostPhone of ghostPhones) {
    const validation = await validateWhatsAppNumber(
      ghostPhone.numero,
      whatsappInstanceId,
      customerName,
      supabaseUrl,
      supabaseKey
    );

    if (validation.verified) {
      validations.push(validation);
    }
  }

  if (validations.length === 0) {
    console.log('Nenhum telefone válido encontrado no WhatsApp');
    return null;
  }

  const scoredPhones = validations.map(v => ({
    phone: v.phone,
    name: v.name,
    score: 50 + (v.nameSimilarity || 0) / 2,
    nameSimilarity: v.nameSimilarity || 0,
  }));

  scoredPhones.sort((a, b) => b.score - a.score);

  const bestPhone = scoredPhones[0];

  console.log(`\n=== Resultado da validação ===`);
  console.log(`Melhor telefone: ${bestPhone.phone}`);
  console.log(`Nome do WhatsApp: ${bestPhone.name}`);
  console.log(`Similaridade: ${bestPhone.nameSimilarity}%`);
  console.log(`Score: ${bestPhone.score}`);

  if (bestPhone.score >= 60) {
    console.log(`✅ Telefone aceito (score >= 60)`);
    return bestPhone.phone;
  } else {
    console.log(`❌ Telefone rejeitado (score < 60)`);
    return null;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) return `55${cleaned}`;
  if (cleaned.length === 10) return `55${cleaned}`;
  return cleaned;
}

function extractCPF(order: any): string | null {
  const possibleFields = [
    order.invoice_nip,
    order.extra_field_1,
    order.extra_field_2,
    order.buyer_company,
  ];

  for (const field of possibleFields) {
    if (field && typeof field === 'string') {
      const cpfMatch = field.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
      if (cpfMatch) {
        return cpfMatch[0].replace(/\D/g, '');
      }
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event } = await req.json();

    if (!event || !event.order_id) {
      throw new Error('Invalid event data');
    }

    const workspaceId = event.workspace_id;
    if (!workspaceId) {
      throw new Error('No workspace_id in event data');
    }

    console.log(`Processing order: ${event.order_id} for workspace ${workspaceId}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const baselinkerToken = await getBaselinkerToken(supabaseClient, workspaceId);

    console.log(`Fetching order ${event.order_id} from Baselinker`);

    const baselinkerConfig: BaselinkerConfig = {
      token: baselinkerToken,
      workspace_id: workspaceId,
    };

    const fullOrder = await fetchOrderDetails(baselinkerConfig, event.order_id);

    if (!fullOrder) {
      throw new Error(`Order ${event.order_id} not found in Baselinker`);
    }

    console.log(`Fetched order details: ${fullOrder.delivery_fullname}`);

    // ========================================================================
    // STEP 1: Create or find client
    // ========================================================================

    const cpf = extractCPF(fullOrder);
    const phone = formatPhoneNumber(fullOrder.phone);
    const email = fullOrder.email;

    let client = null;

    if (cpf) {
      const { data: existingClient } = await supabaseClient
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('cpf', cpf)
        .maybeSingle();

      client = existingClient;
    }

    if (!client && phone) {
      const { data: existingClient } = await supabaseClient
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('phone', phone)
        .maybeSingle();

      client = existingClient;
    }

    if (!client) {
      console.log('Creating new client');

      // VALIDAÇÃO AVANÇADA DE TELEFONE
      let validatedPhone: string | null = phone;

      if (!phone && cpf) {
        console.log('⚠️ Pedido sem telefone - Iniciando busca no GhostAPI + validação WhatsApp');

        const { data: whatsappInstance } = await supabaseClient
          .from('whatsapp_instances')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('status', 'connected')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (whatsappInstance) {
          const customerName = fullOrder.delivery_fullname || fullOrder.invoice_fullname || 'Cliente';

          validatedPhone = await validateAndFindBestPhone(
            cpf,
            customerName,
            workspaceId,
            whatsappInstance.id,
            supabaseClient
          );

          if (validatedPhone) {
            console.log(`✅ Telefone validado: ${validatedPhone}`);
          } else {
            console.log(`❌ Nenhum telefone válido - Cliente SEM telefone`);
          }
        } else {
          console.log('⚠️ Sem instância WhatsApp ativa');
        }
      } else if (phone) {
        console.log(`ℹ️ Telefone do pedido: ${phone}`);
      }

      const { data: newClient, error: clientError } = await supabaseClient
        .from('clients')
        .insert({
          workspace_id: workspaceId,
          name: fullOrder.delivery_fullname || fullOrder.invoice_fullname || 'Cliente',
          phone: validatedPhone,
          email: email || null,
          cpf: cpf,
          metadata: {
            source: 'baselinker',
            first_order_id: fullOrder.order_id,
            delivery_address: fullOrder.delivery_address,
            delivery_city: fullOrder.delivery_city,
            delivery_state: fullOrder.delivery_state,
            delivery_postcode: fullOrder.delivery_postcode,
            phone_validation: validatedPhone ? {
              validated: true,
              source: !phone ? 'ghost_api_whatsapp' : 'baselinker',
              validated_at: new Date().toISOString(),
            } : {
              validated: false,
              reason: !phone && cpf ? 'no_valid_phone_found' : 'no_phone_in_order',
            }
          },
        })
        .select()
        .single();

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`);
      }

      client = newClient;

      // Send welcome message only if has valid phone
      if (validatedPhone) {
        await sendWelcomeMessage(supabaseClient, workspaceId, client, fullOrder);
      } else {
        console.log('⚠️ Cliente criado sem telefone - Mensagem NÃO enviada');
      }
    } else {
      console.log(`Found existing client: ${client.id}`);
    }

    // ========================================================================
    // STEP 2: Check if order already exists
    // ========================================================================

    const { data: existingOrder } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('order_id_base', fullOrder.order_id)
      .maybeSingle();

    if (existingOrder) {
      console.log(`Order ${fullOrder.order_id} already exists, skipping`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Order already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 3: Create order
    // ========================================================================

    console.log('Creating order record');

    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        workspace_id: workspaceId,
        client_id: client.id,
        external_id: fullOrder.order_id.toString(),
        order_id_base: fullOrder.order_id,
        total_amount: fullOrder.order_total_price_brutto || 0,
        status: fullOrder.order_status_name || 'pending',
        order_date: new Date(fullOrder.date_add * 1000).toISOString(),
        canal_venda: fullOrder.order_source || 'unknown',
        cpf: cpf,
        metadata: {
          baselinker_data: fullOrder,
          payment_method: fullOrder.payment_method,
          delivery_method: fullOrder.delivery_method,
          delivery_price: fullOrder.delivery_price,
        },
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    console.log(`Created order: ${order.id}`);

    // ========================================================================
    // STEP 4: Create order products
    // ========================================================================

    if (fullOrder.products && fullOrder.products.length > 0) {
      const productsToInsert = fullOrder.products.map((product) => ({
        order_id: order.id,
        order_base_id: fullOrder.order_id,
        nome_produto: product.name,
        sku: product.sku,
        quantidade_produtos: product.quantity,
        receita_bruta: product.price_brutto * product.quantity,
        taxas_produto: (product.price_brutto * product.quantity * product.tax_rate) / 100,
      }));

      const { error: productsError } = await supabaseClient
        .from('orders_products')
        .insert(productsToInsert);

      if (productsError) {
        console.error('Error creating order products:', productsError);
      } else {
        console.log(`Created ${productsToInsert.length} order products`);
      }
    }

    // ========================================================================
    // STEP 5: Send upsell message immediately
    // ========================================================================

    await sendUpsellMessage(supabaseClient, workspaceId, order, client, fullOrder);

    // ========================================================================
    // STEP 6: Schedule reorder messages
    // ========================================================================

    await scheduleReorderMessages(supabaseClient, workspaceId, order, client, fullOrder);

    // ========================================================================
    // STEP 7: Update client stats
    // ========================================================================

    await updateClientStats(supabaseClient, client.id);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        client_id: client.id,
        client_is_new: existingOrder === null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-order-created:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function sendWelcomeMessage(supabase: any, workspaceId: string, client: any, order?: any) {
  try {
    if (!client.phone) {
      console.log('Client has no phone, skipping welcome message');
      return;
    }

    const message = await getWelcomeMessage(supabase, workspaceId, {
      client_name: client.name,
      order_id: order?.order_id_base?.toString() || ''
    });

    await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);

    await supabase.from('messages').insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_welcome',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot',
    });

    console.log(`✅ Sent welcome message to ${client.phone}`);
  } catch (error) {
    console.error('❌ Error sending welcome message:', error);
  }
}

async function sendUpsellMessage(
  supabase: any,
  workspaceId: string,
  order: any,
  client: any,
  fullOrder: any
) {
  try {
    if (!client.phone) {
      console.log('Client has no phone, skipping upsell message');
      return;
    }

    if (!fullOrder.products || fullOrder.products.length === 0) {
      console.log('Order has no products, skipping upsell message');
      return;
    }

    const firstProduct = fullOrder.products[0];
    const originalPrice = firstProduct.price_brutto * firstProduct.quantity;
    const discountedPrice = originalPrice * 0.80;

    const message = await getUpsellMessage(supabase, workspaceId, {
      client_name: client.name,
      product_name: firstProduct.name,
      original_price: originalPrice.toFixed(2),
      discounted_price: discountedPrice.toFixed(2)
    });

    await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);

    await supabase
      .from('orders')
      .update({ mensagem_enviada: true })
      .eq('id', order.id);

    await supabase.from('messages').insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_upsell',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot',
      metadata: {
        order_id: order.id,
        product_sku: firstProduct.sku,
        product_name: firstProduct.name,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        discount_percentage: 20
      },
    });

    console.log(`✅ Sent upsell message to ${client.phone}`);
  } catch (error) {
    console.error('❌ Error sending upsell message:', error);
  }
}

async function scheduleReorderMessages(
  supabase: any,
  workspaceId: string,
  order: any,
  client: any,
  fullOrder: any
) {
  try {
    for (const product of fullOrder.products) {
      const { data: productData } = await supabase
        .from('products')
        .select('duracao, name')
        .eq('workspace_id', workspaceId)
        .eq('sku', product.sku)
        .maybeSingle();

      if (!productData || !productData.duracao) {
        console.log(`Product ${product.sku} has no duration, skipping reorder schedule`);
        continue;
      }

      const orderDate = new Date(order.order_date);
      const durationDays = productData.duracao * product.quantity;
      const reorderDate = new Date(orderDate);
      reorderDate.setDate(reorderDate.getDate() + durationDays - 15);

      if (reorderDate < new Date()) {
        console.log(`Reorder date for ${product.sku} is in the past, skipping`);
        continue;
      }

      const message = await getReorderMessage(supabase, workspaceId, {
        client_name: client.name,
        product_name: productData.name,
        product_sku: product.sku,
        order_date: new Date(order.order_date).toLocaleDateString('pt-BR'),
        duration_days: durationDays
      });

      await supabase.from('scheduled_messages').insert({
        workspace_id: workspaceId,
        client_id: client.id,
        message_type: 'reorder',
        message_content: message,
        scheduled_for: reorderDate.toISOString(),
        status: 'pending',
        metadata: {
          order_id: order.id,
          product_sku: product.sku,
          product_name: productData.name,
          duration_days: durationDays,
        },
      });

      await supabase
        .from('orders_products')
        .update({ mensagem_recompra: true })
        .eq('order_id', order.id)
        .eq('sku', product.sku);

      console.log(`✅ Scheduled reorder message for ${product.sku} on ${reorderDate.toISOString()}`);
    }
  } catch (error) {
    console.error('Error scheduling reorder messages:', error);
  }
}

async function updateClientStats(supabase: any, clientId: string) {
  try {
    const { data: stats } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('client_id', clientId);

    if (!stats) return;

    const totalSpent = stats.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
    const totalOrders = stats.length;

    await supabase
      .from('clients')
      .update({
        total_gasto: totalSpent,
        total_pedidos: totalOrders,
        ultima_att: new Date().toISOString(),
      })
      .eq('id', clientId);

    console.log(`Updated client stats: ${totalOrders} orders, R$ ${totalSpent}`);
  } catch (error) {
    console.error('Error updating client stats:', error);
  }
}
