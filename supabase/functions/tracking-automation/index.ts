import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Supabase client setup
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const woncaApiKey = Deno.env.get("WONCA_API_KEY") || "";
const jadlogToken = Deno.env.get("JADLOG_TOKEN") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TrackingEvent {
  data: string;
  descricao: string;
  detalhe: string;
  cidade: string;
  uf: string;
  tipo: string;
  sigla: string;
}

interface TrackingResult {
  codigoRastreamento: string;
  dataPrevista: string | null;
  dataPostagem: string | null;
  statusAtual: {
    data: string;
    descricao: string;
    detalhe: string;
    cidade: string;
    uf: string;
    tipo: string;
    sigla: string;
  } | null;
  eventos: TrackingEvent[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("Starting tracking automation...");
    
    // Get current date minus 6 hours (like in your n8n workflow)
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
    
    // Get all purchases that need tracking update
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('*')
      .neq('trackingCode', null)
      .eq('is_archived', false)
      .or(`atualizado.is.null,atualizado.lt.${sixHoursAgo.toISOString()}`);

    if (purchasesError) {
      throw new Error(`Error fetching purchases: ${purchasesError.message}`);
    }

    console.log(`Found ${purchases?.length || 0} purchases to update`);

    if (!purchases || purchases.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No purchases to update",
        updated: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Process each purchase
    for (const purchase of purchases) {
      try {
        console.log(`Processing tracking for: ${purchase.trackingCode} (${purchase.carrier})`);
        
        let trackingResult: TrackingResult | null = null;

        // Route to appropriate tracking service based on carrier
        if (purchase.carrier?.toLowerCase().includes('correios')) {
          trackingResult = await trackCorreios(purchase.trackingCode);
        } else if (purchase.carrier?.toLowerCase().includes('jadlog')) {
          trackingResult = await trackJadlog(purchase.trackingCode);
        } else {
          console.log(`Unsupported carrier: ${purchase.carrier}`);
          continue;
        }

        if (trackingResult && trackingResult.statusAtual) {
          // Update purchase with tracking info
          const { error: updateError } = await supabase
            .from('purchases')
            .update({
              status: trackingResult.statusAtual.descricao,
              estimated_delivery: trackingResult.dataPrevista,
              updated_at: trackingResult.statusAtual.data,
              atualizado: new Date().toISOString()
            })
            .eq('trackingCode', purchase.trackingCode);

          if (updateError) {
            console.error(`Error updating purchase ${purchase.trackingCode}:`, updateError);
            errorCount++;
          } else {
            console.log(`Successfully updated: ${purchase.trackingCode}`);
            updatedCount++;
          }
        }

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing ${purchase.trackingCode}:`, error);
        errorCount++;
      }
    }

    // Also update returns and transfers
    await updateReturns();
    await updateTransfers();

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Tracking automation completed`,
      updated: updatedCount,
      errors: errorCount,
      total: purchases.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in tracking automation:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function trackCorreios(trackingCode: string): Promise<TrackingResult | null> {
  try {
    if (!woncaApiKey) {
      throw new Error("WONCA_API_KEY not configured");
    }

    const response = await fetch("https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track", {
      method: "POST",
      headers: {
        "Authorization": `Apikey ${woncaApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code: trackingCode })
    });

    if (!response.ok) {
      throw new Error(`Correios API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.result) {
      return null;
    }

    // Parse the response similar to your n8n Code node
    const dados = data.result;
    const eventos = Array.isArray(dados?.eventos) ? dados.eventos : [];
    
    // Sort events by date (newest first)
    eventos.sort((a: any, b: any) => 
      new Date(b.dtHrCriado?.date || 0).getTime() - new Date(a.dtHrCriado?.date || 0).getTime()
    );

    const statusAtual = eventos.length > 0 ? {
      data: eventos[0].dtHrCriado?.date || new Date().toISOString(),
      descricao: eventos[0].descricao || '',
      detalhe: eventos[0].detalhe || '',
      cidade: eventos[0].unidade?.endereco?.cidade || '',
      uf: eventos[0].unidade?.endereco?.uf || '',
      tipo: eventos[0].codigo || '',
      sigla: eventos[0].tipo || ''
    } : null;

    let dataPrevista = null;
    if (dados?.dtPrevista) {
      const [dia, mes, ano] = dados.dtPrevista.split('/');
      if (dia && mes && ano) {
        dataPrevista = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia)).toISOString();
      }
    }

    const dataPostagem = eventos.length > 0
      ? eventos[eventos.length - 1].dtHrCriado?.date || null
      : null;

    return {
      codigoRastreamento: trackingCode,
      dataPrevista,
      dataPostagem,
      statusAtual,
      eventos: eventos.map((e: any) => ({
        data: e.dtHrCriado?.date || '',
        descricao: e.descricao || '',
        detalhe: e.detalhe || '',
        cidade: e.unidade?.endereco?.cidade || '',
        uf: e.unidade?.endereco?.uf || '',
        tipo: e.codigo || '',
        sigla: e.tipo || ''
      }))
    };

  } catch (error) {
    console.error(`Error tracking Correios ${trackingCode}:`, error);
    return null;
  }
}

async function trackJadlog(trackingCode: string): Promise<TrackingResult | null> {
  try {
    if (!jadlogToken) {
      throw new Error("JADLOG_TOKEN not configured");
    }

    const response = await fetch("https://prd-traffic.jadlogtech.com.br/embarcador/api/tracking/consultar", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jadlogToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        consulta: [{ shipmentId: trackingCode }]
      })
    });

    if (!response.ok) {
      throw new Error(`Jadlog API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.consulta || !Array.isArray(data.consulta) || data.consulta.length === 0) {
      return null;
    }

    const consulta = data.consulta[0];
    const tracking = consulta.tracking;
    
    if (!tracking || !tracking.eventos) {
      return null;
    }

    // Sort events by date (newest first)
    const eventos = Array.isArray(tracking.eventos) ? tracking.eventos : [];
    eventos.sort((a: any, b: any) => 
      new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
    );

    const statusAtual = eventos.length > 0 ? {
      data: eventos[0].data || new Date().toISOString(),
      descricao: tracking.status || eventos[0].descricao || '',
      detalhe: eventos[0].detalhe || '',
      cidade: eventos[0].cidade || '',
      uf: eventos[0].uf || '',
      tipo: eventos[0].tipo || '',
      sigla: eventos[0].sigla || ''
    } : null;

    return {
      codigoRastreamento: trackingCode,
      dataPrevista: null, // Jadlog doesn't provide estimated delivery in this format
      dataPostagem: eventos.length > 0 ? eventos[eventos.length - 1].data : null,
      statusAtual,
      eventos: eventos.map((e: any) => ({
        data: e.data || '',
        descricao: e.descricao || '',
        detalhe: e.detalhe || '',
        cidade: e.cidade || '',
        uf: e.uf || '',
        tipo: e.tipo || '',
        sigla: e.sigla || ''
      }))
    };

  } catch (error) {
    console.error(`Error tracking Jadlog ${trackingCode}:`, error);
    return null;
  }
}

async function updateReturns(): Promise<void> {
  try {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
    
    const { data: returns, error } = await supabase
      .from('returns')
      .select('*')
      .neq('trackingCode', null)
      .eq('is_archived', false)
      .or(`updated_at.is.null,updated_at.lt.${sixHoursAgo.toISOString()}`);

    if (error || !returns) return;

    for (const returnItem of returns) {
      try {
        let trackingResult: TrackingResult | null = null;

        if (returnItem.carrier?.toLowerCase().includes('correios')) {
          trackingResult = await trackCorreios(returnItem.trackingCode);
        } else if (returnItem.carrier?.toLowerCase().includes('jadlog')) {
          trackingResult = await trackJadlog(returnItem.trackingCode);
        }

        if (trackingResult && trackingResult.statusAtual) {
          await supabase
            .from('returns')
            .update({
              status: trackingResult.statusAtual.descricao,
              estimated_delivery: trackingResult.dataPrevista,
              updated_at: new Date().toISOString()
            })
            .eq('trackingCode', returnItem.trackingCode);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error updating return ${returnItem.trackingCode}:`, error);
      }
    }
  } catch (error) {
    console.error("Error updating returns:", error);
  }
}

async function updateTransfers(): Promise<void> {
  try {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
    
    const { data: transfers, error } = await supabase
      .from('transfers')
      .select('*')
      .neq('trackingCode', null)
      .eq('is_archived', false)
      .or(`updated_at.is.null,updated_at.lt.${sixHoursAgo.toISOString()}`);

    if (error || !transfers) return;

    for (const transfer of transfers) {
      try {
        let trackingResult: TrackingResult | null = null;

        if (transfer.carrier?.toLowerCase().includes('correios')) {
          trackingResult = await trackCorreios(transfer.trackingCode);
        } else if (transfer.carrier?.toLowerCase().includes('jadlog')) {
          trackingResult = await trackJadlog(transfer.trackingCode);
        }

        if (trackingResult && trackingResult.statusAtual) {
          await supabase
            .from('transfers')
            .update({
              status: trackingResult.statusAtual.descricao,
              estimated_delivery: trackingResult.dataPrevista,
              updated_at: new Date().toISOString()
            })
            .eq('trackingCode', transfer.trackingCode);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error updating transfer ${transfer.trackingCode}:`, error);
      }
    }
  } catch (error) {
    console.error("Error updating transfers:", error);
  }
}