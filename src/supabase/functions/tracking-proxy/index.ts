import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { carrier, trackingCode } = await req.json();

    if (!trackingCode) {
      return new Response(
        JSON.stringify({ success: false, error: "Tracking code is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (carrier.toLowerCase().includes("correios")) {
      try {
        // Call Correios API via Wonca
        const response = await fetch("https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Apikey WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684"
          },
          body: JSON.stringify({"code": trackingCode })
        });

        if (!response.ok) {
          console.error(`Wonca API error: ${response.status} ${response.statusText}`);
          
          // If we get a 401, the API key is invalid
          if (response.status === 401) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "API key is invalid or expired",
                message: "Erro de autenticação com a API de rastreamento. Por favor, contate o suporte."
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          
          // For other errors, return a generic error
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Error from tracking API: ${response.status} ${response.statusText}`,
              message: "Erro ao consultar o rastreamento. Tente novamente mais tarde."
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const data = await response.json();
        
        // If the API returns an error, format it nicely
        if (!data.success) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: data.message || "Unknown error from tracking API",
              message: "Não foi possível rastrear o objeto. Verifique o código e tente novamente."
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        // Return the successful response
        return new Response(
          JSON.stringify(data),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Error calling Wonca API:", error);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message || "Error calling tracking API",
            message: "Erro ao conectar com o serviço de rastreamento. Tente novamente mais tarde."
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (carrier.toLowerCase().includes("jadlog")) {
      // Placeholder for Jadlog API
      // In a real implementation, you would call the Jadlog API here
      
      // For now, return a mock response
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            code: trackingCode,
            events: [
              {
                date: new Date().toISOString(),
                status: "Em trânsito",
                location: "São Paulo, SP"
              }
            ],
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // For other carriers, return a generic response
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            code: trackingCode,
            events: [
              {
                date: new Date().toISOString(),
                status: `Em processamento pela ${carrier}`,
                location: "Brasil"
              }
            ],
            estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in tracking proxy:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Internal server error",
        message: "Erro interno no servidor. Por favor, tente novamente mais tarde."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});