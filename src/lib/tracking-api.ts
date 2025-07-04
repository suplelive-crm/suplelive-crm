/**
 * Função ÚNICA e simplificada para chamar nosso proxy de rastreamento no back-end.
 * O front-end não precisa mais saber sobre APIs específicas ou chaves.
 */
export async function trackPackage(carrier: string, trackingCode: string): Promise<any> {
  // Validação inicial no front-end para evitar chamadas de API desnecessárias.
  if (!carrier || !trackingCode) {
    throw new Error('Transportadora e código de rastreio são obrigatórios.');
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // A chamada 'fetch' foi construída corretamente em uma única declaração.
    const response = await fetch(`${supabaseUrl}/functions/v1/tracking-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Apikey WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684`
      },
      // Enviamos um payload padronizado que nosso back-end entende.
      body: JSON.stringify({ 
        carrier,
        trackingCode 
      })
    });

    // Se a resposta do nosso proxy não for OK, lança um erro.
    if (!response.ok) {
      const errorData = await response.json();
      // Usa a mensagem de erro amigável que o nosso proxy retorna.
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error in trackPackage function:', error);
    // Re-lança o erro para que a camada superior (Zustand store) possa capturá-lo.
    throw error;
  }
}

/**
 * Analisa a resposta (já tratada pelo nosso proxy) e a transforma em um formato padrão para a UI.
 * CORRIGIDO com optional chaining para evitar quebras.
 */
export function parseTrackingResponse(carrier: string, response: any): {
  status: string;
  estimatedDelivery?: string;
  lastUpdate: string;
  history: { date: string; status: string; location?: string }[];
} {
  // O fallback padrão caso algo dê errado ou a resposta seja inesperada.
  const fallbackResponse = {
    status: 'Status desconhecido',
    lastUpdate: new Date().toISOString(),
    history: [],
  };

  if (response?.success && response?.result) {
    // Usamos optional chaining (?.) para acessar propriedades com segurança.
    const lastEvent = response.result.events?.[0];
    
    return {
      // Se lastEvent não existir, usamos um status padrão.
      status: lastEvent?.status || 'Aguardando postagem',
      estimatedDelivery: response.result.estimatedDelivery,
      lastUpdate: lastEvent?.date || new Date().toISOString(),
      // Se events não existir, retornamos um array vazio.
      history: response.result.events?.map((event: any) => ({
        date: event.date,
        status: event.status,
        location: event.location
      })) || []
    };
  }

  return fallbackResponse;
}

/**
 * Monta a URL de rastreamento direto no site da transportadora.
 * (Esta função já estava correta e foi mantida).
 */
export function getTrackingUrl(carrier: string, trackingCode: string): string {
  if (!trackingCode) {
    return '';
  }

  const carrierLower = carrier.toLowerCase();
  
  if (carrierLower.includes('correios')) {
    return `https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}`;
  } else if (carrierLower.includes('jadlog')) {
    return `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${trackingCode}`;
  } else if (carrierLower.includes('total')) {
    return `https://www.totalexpress.com.br/tracking/${trackingCode}`;
  } else if (carrierLower.includes('azul')) {
    return `https://rastreamento.azulcargo.com.br/tracking/${trackingCode}`;
  } else if (carrierLower.includes('braspress')) {
    return `https://www.braspress.com/tracking/?numNF=${trackingCode}`;
  } else if (carrierLower.includes('mercado')) {
    return `https://www.mercadolivre.com.br/envios/tracking/${trackingCode}`;
  }
  
  return '';
}