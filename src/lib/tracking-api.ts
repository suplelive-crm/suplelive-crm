// Tracking API for Correios and Jadlog

// Correios tracking via Wonca API
export async function trackCorreios(trackingCode: string): Promise<any> {
  try {
    // Instead of direct API call, use Supabase Edge Function as a proxy
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': "Apikey WNgBGbjeRSefHGihDVlxlEy3ZHW2EE9z-GtOjW2W684"
      },
      body: JSON.stringify({ 
        carrier: 'correios',
        trackingCode 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error tracking Correios package:', error);
    throw error;
  }
}

// Jadlog tracking API
export async function trackJadlog(trackingCode: string): Promise<any> {
  try {
    // Use the same proxy for Jadlog
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/tracking-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        carrier: 'jadlog',
        trackingCode 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error tracking Jadlog package:', error);
    throw error;
  }
}

// Generic tracking function that selects the appropriate carrier API
export async function trackPackage(carrier: string, trackingCode: string): Promise<any> {
  if (!trackingCode) {
    throw new Error('Código de rastreio é obrigatório');
  }

  switch (carrier.toLowerCase()) {
    case 'correios':
      return trackCorreios(trackingCode);
    case 'jadlog':
      return trackJadlog(trackingCode);
    default:
      // For other carriers, use the generic proxy
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/tracking-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          carrier,
          trackingCode 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
  }
}

// Get tracking URL for external tracking websites
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
  
  // Default fallback - return empty string if carrier not supported
  return '';
}

// Parse tracking response into a standardized format
export function parseTrackingResponse(carrier: string, response: any): {
  status: string;
  estimatedDelivery?: string;
  lastUpdate: string;
  history: { date: string; status: string; location?: string }[];
} {
  if (carrier.toLowerCase().includes('correios')) {
    // Parse Wonca/Correios response
    if (response.success && response.result) {
      const lastEvent = response.result.events[0];
      
      return {
        status: lastEvent.status,
        estimatedDelivery: response.result.estimatedDelivery,
        lastUpdate: lastEvent.date,
        history: response.result.events.map((event: any) => ({
          date: event.date,
          status: event.status,
          location: event.location
        }))
      };
    }
  } else if (carrier.toLowerCase().includes('jadlog')) {
    // Parse Jadlog response - this is a placeholder
    // You'll need to adapt this to the actual Jadlog API response format
    if (response.result) {
      const events = response.result.events || [];
      
      return {
        status: events[0]?.status || 'Status desconhecido',
        estimatedDelivery: response.result.estimatedDelivery,
        lastUpdate: events[0]?.date || new Date().toISOString(),
        history: events.map((event: any) => ({
          date: event.date,
          status: event.status,
          location: event.location
        }))
      };
    }
  } else {
    // Generic parser for other carriers
    if (response.result) {
      const events = response.result.events || [];
      
      return {
        status: events[0]?.status || 'Status desconhecido',
        estimatedDelivery: response.result.estimatedDelivery,
        lastUpdate: events[0]?.date || new Date().toISOString(),
        history: events.map((event: any) => ({
          date: event.date,
          status: event.status,
          location: event.location
        }))
      };
    }
  }
  
  // Default fallback
  return {
    status: 'Status desconhecido',
    lastUpdate: new Date().toISOString(),
    history: []
  };
}