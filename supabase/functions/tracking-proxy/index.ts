// Importa o servidor HTTP do Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Cabeçalhos CORS para permitir que seu app front-end acesse esta função
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Inicia o servidor para processar as requisições
serve(async (req: Request) => {
  // Responde a requisições de 'preflight' do CORS, necessárias para o navegador
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Extrai os dados enviados pelo front-end
    const { carrier, trackingCode } = await req.json();

    // Validação básica dos dados recebidos
    if (!carrier || !trackingCode) {
      return new Response(
        JSON.stringify({ success: false, message: "Transportadora e código de rastreio são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- LÓGICA PARA OS CORREIOS (via API Wonca) ---
    if (carrier.toLowerCase().includes("Correios")) {
      try {
        // Busca a chave de API dos Segredos do Supabase. É mais seguro.
        const woncaApiKey = Deno.env.get("WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684");
        if (!woncaApiKey) {
          throw new Error("A chave de API da Wonca (WONCA_API_KEY) não foi configurada nos segredos do Supabase.");
        }
        
        // Faz a chamada real para a API da Wonca
        const response = await fetch("https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Apikey WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684`
          },
          body: JSON.stringify({ code: trackingCode })
        });

        // Trata respostas de erro da API
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
        
        // Retorna a resposta de sucesso para o front-end
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
    
    // --- LÓGICA PARA A JADLOG (EXEMPLO) ---
    else if (carrier.toLowerCase().includes("jadlog")) {
      try {
        // IMPORTANTE: Este bloco é um exemplo e deve ser validado com a documentação oficial da Jadlog.
        const jadlogApiKey = Deno.env.get("JADLOG_API_KEY");
         if (!jadlogApiKey) {
          throw new Error("A chave de API da Jadlog (JADLOG_API_KEY) não foi configurada nos segredos do Supabase.");
        }

        const response = await fetch("https://api.jadlog.com.br/v1/tracking", { // URL de exemplo
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jadlogApiKey}` // Formato de exemplo
          },
          body: JSON.stringify({ code: trackingCode }) // Corpo de exemplo
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`Jadlog API error: ${response.status}`, errorBody);
          return new Response(
            JSON.stringify({ success: false, message: "Falha na API da Jadlog.", details: errorBody }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        
        return new Response(JSON.stringify({ success: true, result: data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("Error calling Jadlog API:", error.message);
        return new Response(
          JSON.stringify({ success: false, message: "Erro interno ao processar rastreamento da Jadlog." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } 
    
    // --- LÓGICA PARA OUTRAS TRANSPORTADORAS ---
    else {
      // Em vez de dados falsos, retorna um erro claro de que a transportadora não é suportada.
      return new Response(
        JSON.stringify({
          success: false,
          message: `A transportadora '${carrier}' não é suportada no momento.`
        }),
        {
          status: 400, // Bad Request, pois a transportadora enviada não é válida
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    // Captura erros gerais, como um JSON mal formatado na requisição
    console.error("Error in tracking proxy:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno no servidor de rastreamento." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});