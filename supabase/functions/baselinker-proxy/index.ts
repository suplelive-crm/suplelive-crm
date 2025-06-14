// supabase/functions/baselinker-proxy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey, method, parameters = {} }: BaselinkerRequest = await req.json()

    if (!apiKey || !method) {
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_message: 'API key and method are required',
          error_code: 'MISSING_PARAMETERS'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Monta o formulário para a API da Baselinker
    const formData = new URLSearchParams();
    formData.append('method', method);

    // Itera sobre os parâmetros e os adiciona ao formulário.
    // Esta é a correção principal: cada parâmetro é enviado como um campo separado.
    for (const key in parameters) {
      // Verifica se a propriedade pertence ao objeto para evitar problemas de protótipo
      if (Object.prototype.hasOwnProperty.call(parameters, key)) {
        const value = parameters[key];
        // A API da Baselinker espera que arrays e objetos sejam passados como uma string JSON
        if (typeof value === 'object' && value !== null) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    }

    // Faz a chamada para a API da Baselinker
    const response = await fetch('https://api.baselinker.com/connector.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-BLToken': apiKey // Header recomendado pela Baselinker para autenticação
      },
      body: formData.toString()
    })

    // Trata erros de HTTP (ex: 401, 403, 429)
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error ${response.status}: ${errorText}`;
      // Tenta extrair uma mensagem mais amigável se possível
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error_message || errorMessage;
      } catch (e) {
        // Ignora o erro de parse se a resposta não for JSON
      }
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_message: errorMessage,
          error_code: `HTTP_${response.status}`
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = await response.json();

    // Trata erros específicos retornados pela API da Baselinker
    if (result.status === 'ERROR') {
      console.error('Baselinker API returned an error:', result);
      return new Response(
        JSON.stringify(result), // Repassa o erro original da Baselinker
        {
          status: 400, // Usa um status de erro genérico do cliente
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Retorna a resposta de sucesso para o cliente
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
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})