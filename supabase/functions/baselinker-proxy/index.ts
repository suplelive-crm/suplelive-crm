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

    console.log(`Making Baselinker API request: ${method}`, { parameters })

    // Make request to Baselinker API using both header and token parameter
    // This provides backward compatibility with their API
    const formData = new URLSearchParams();
    formData.append('token', apiKey); // Include token in the body as fallback
    formData.append('method', method);
    formData.append('parameters', JSON.stringify(parameters));

    const response = await fetch('https://api.baselinker.com/connector.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-BLToken': apiKey // Recommended header approach
      },
      body: formData.toString()
    })

    if (!response.ok) {
      console.error(`Baselinker API HTTP error: ${response.status} ${response.statusText}`)
      
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key or insufficient permissions'
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden - check API key permissions'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded - please wait before making more requests'
      }

      return new Response(
        JSON.stringify({ 
          status: 'ERROR', 
          error_message: errorMessage,
          error_code: response.status === 401 ? 'ERROR_INVALID_API_KEY' : 'HTTP_ERROR'
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const responseText = await response.text()
    console.log('Baselinker API response:', responseText)

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Baselinker response as JSON:', parseError)
      return new Response(
        JSON.stringify({ 
          status: 'ERROR', 
          error_message: 'Invalid response format from Baselinker API',
          error_code: 'INVALID_RESPONSE'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if Baselinker returned an error
    if (result.status === 'ERROR') {
      console.error('Baselinker API error:', result)
      
      // Map common Baselinker error codes to user-friendly messages
      let errorMessage = result.error_message || 'Unknown error from Baselinker API'
      
      if (result.error_code === 'ERROR_INVALID_API_KEY') {
        errorMessage = 'Invalid API key. Please check your Baselinker API token.'
      } else if (result.error_code === 'ERROR_PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Your API key does not have the required permissions.'
      } else if (result.error_code === 'ERROR_METHOD_NOT_EXISTS') {
        errorMessage = 'Invalid API method. Please contact support.'
      } else if (result.error_code === 'ERROR_INVALID_PARAMETERS') {
        errorMessage = 'Invalid parameters provided to the API method.'
      }

      return new Response(
        JSON.stringify({ 
          status: 'ERROR', 
          error_message: errorMessage,
          error_code: result.error_code || 'BASELINKER_ERROR'
        }),
        { 
          status: result.error_code === 'ERROR_INVALID_API_KEY' ? 401 : 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Return successful response
    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Proxy function error:', error)
    
    return new Response(
      JSON.stringify({ 
        status: 'ERROR', 
        error_message: 'Internal server error in proxy function',
        error_code: 'PROXY_ERROR'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})