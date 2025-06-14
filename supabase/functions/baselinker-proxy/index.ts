// supabase/functions/baselinker-proxy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Headers CORS para permitir a comunicação com seu front-end
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, X-BLToken',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BaselinkerRequest {
  apiKey: string;
  method: string;
  parameters?: Record<string, any>;
}

serve(async (req) => {
  // Trata a requisição de preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey, method, parameters = {} }: BaselinkerRequest = await req.json()

    // Validação básica dos dados recebidos
    if (!apiKey || !method) {
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_message: 'API key and method are required',
          error_code: 'MISSING_PARAMETERS'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Monta o formulário para a API da Baselinker conforme a documentação
    const formData = new URLSearchParams();
    formData.append('method', method);
    formData.append('parameters', JSON.stringify(parameters)); // <-- FORMATO CORRETO

    // Faz a chamada para a API da Baselinker
    const response = await fetch('https://api.baselinker.com/connector.php', { //
      method: 'POST', //
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-BLToken': apiKey // Autenticação via header, como recomendado
      },
      body: formData.toString()
    })

    // Tratamento de erros HTTP e da API (seu código anterior já era bom nisso)
    if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ status: 'ERROR', error_message: `HTTP Error: ${response.status} - ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const result = await response.json();

    if (result.status === 'ERROR') {
        console.error('Baselinker API returned an error:', result);
    }

    // Retorna a resposta final para o cliente
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('An unexpected error occurred in the proxy function:', error)
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: 'Internal Server Error: ' + error.message,
        error_code: 'PROXY_INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})