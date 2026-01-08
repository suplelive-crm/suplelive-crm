// Edge Function: Validar Número de WhatsApp via Evolution API
// Verifica se número existe no WhatsApp e retorna nome do usuário

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  phone: string; // Telefone no formato: 5527999999999
  instanceId: string; // ID da instância Evolution API
}

interface ValidationResponse {
  exists: boolean;
  name?: string;
  phone: string;
  verified: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, instanceId }: ValidationRequest = await req.json();

    if (!phone || !instanceId) {
      throw new Error('Phone and instanceId are required');
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações da instância Evolution API
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('evolution_url, evolution_api_key')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error('WhatsApp instance not found');
    }

    const evolutionUrl = instance.evolution_url;
    const evolutionApiKey = instance.evolution_api_key;

    // Validar número no WhatsApp usando Evolution API
    // Endpoint: GET /chat/whatsappNumbers/:instanceName
    const checkUrl = `${evolutionUrl}/chat/whatsappNumbers/${instanceId}`;

    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        numbers: [phone]
      })
    });

    if (!response.ok) {
      console.error('Evolution API error:', await response.text());
      throw new Error('Failed to validate WhatsApp number');
    }

    const validationResult = await response.json();

    // Formato da resposta Evolution API:
    // [
    //   {
    //     "exists": true,
    //     "jid": "5527999999999@s.whatsapp.net",
    //     "number": "5527999999999",
    //     "name": "João Silva"
    //   }
    // ]

    const result = validationResult[0];

    if (!result) {
      return new Response(
        JSON.stringify({
          exists: false,
          phone,
          verified: false,
        } as ValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        exists: result.exists || false,
        name: result.name || undefined,
        phone: result.number || phone,
        verified: result.exists || false,
      } as ValidationResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating WhatsApp number:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        exists: false,
        verified: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
