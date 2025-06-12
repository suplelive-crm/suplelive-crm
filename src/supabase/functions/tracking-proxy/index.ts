// Importa o servidor HTTP do Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Cabeçalhos CORS para permitir que seu app front-end acesse esta função
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, Apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Inicia o servidor para processar as requisições
serve(async (req: Request) => {
  // Responde a requisições de 'preflight' do CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { carrier, trackingCode } = await req.json();

    if (!carrier || !trackingCode) {
      return new Response(
        JSON.stringify({ success: false, message: "Transportadora e código de rastreio são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- LÓGICA PARA OS CORREIOS (CORRIGIDO) ---
    if (carrier.toLowerCase().includes("correios")) {
      try {
        // Busca a chave de API dos Segredos do Supabase de forma segura
        const woncaApiKey = Deno.env.get("WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684");
        if (!woncaApiKey) {
          throw new Error("A chave de API da Wonca (WONCA_API_KEY) não foi configurada nos segredos do Supabase.");
        }
        
        const response = await fetch("https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track", {
          method: "POST",
          headers: {
            'Content-Type': "application/json",
            // Usa a variável do segredo no cabeçalho
            'Authorization': 'Apikey WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684"
          },
          // Objeto JavaScript correto passado para a função
          body: JSON.stringify({ code: trackingCode })
        });

        if (!response.ok) {
          const errorBody = await response.json();
          console.error(`Wonca API error: ${response.status}`, errorBody);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: errorBody.message || "Erro ao consultar a API de rastreamento.",
              error: `Error from tracking API: ${response.status}`
            }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("Error calling Wonca API:", error.message);
        return new Response(
          JSON.stringify({ success: false, message: "Erro interno ao processar rastreamento dos Correios." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } 
    
    // --- LÓGICA PARA A JADLOG (AINDA COMO EXEMPLO) ---
    else if (carrier.toLowerCase().includes("jadlog")) {
      // Lembre-se que esta parte ainda é um exemplo e precisa ser
      // implementada com a API real da Jadlog para funcionar.
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            code: trackingCode,
            events: [{ date: new Date().toISOString(), status: "Em trânsito (Exemplo)", location: "São Paulo, SP" }],
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } 
    
    // --- LÓGICA PARA OUTRAS TRANSPORTADORAS ---
    else {
      return new Response(
        JSON.stringify({
          success: false,
          message: `A transportadora '${carrier}' não é suportada no momento.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in tracking proxy:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno no servidor de rastreamento." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});