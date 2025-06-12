export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TextClassificationResult {
  category: string;
  confidence: number;
  intent?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
}

export interface ChatbotResponse {
  message: string;
  intent?: string;
  confidence?: number;
  suggestedActions?: Array<{
    type: 'transfer_to_human' | 'create_lead' | 'schedule_callback' | 'send_document';
    label: string;
    data?: any;
  }>;
}

export class OpenAIAPI {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 500,
      ...config,
    };
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async classifyText(text: string, categories: string[]): Promise<TextClassificationResult> {
    const prompt = `
Classifique o seguinte texto em uma das categorias fornecidas e extraia informações relevantes:

Texto: "${text}"

Categorias disponíveis: ${categories.join(', ')}

Responda APENAS com um JSON válido no seguinte formato:
{
  "category": "categoria_escolhida",
  "confidence": 0.95,
  "intent": "intenção_do_usuário",
  "sentiment": "positive|negative|neutral",
  "entities": [
    {
      "type": "nome|telefone|email|produto",
      "value": "valor_extraído",
      "confidence": 0.9
    }
  ]
}
`;

    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em classificação de texto e extração de entidades. Responda sempre com JSON válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      throw new Error('Falha ao processar resposta da classificação de texto');
    }
  }

  async generateChatbotResponse(
    userMessage: string,
    conversationHistory: ChatMessage[],
    context?: {
      clientName?: string;
      clientInfo?: any;
      businessInfo?: any;
      availableActions?: string[];
    }
  ): Promise<ChatbotResponse> {
    const systemPrompt = `
Você é um assistente virtual inteligente para atendimento ao cliente. Suas características:

1. PERSONALIDADE:
   - Profissional, mas amigável e empático
   - Sempre útil e proativo
   - Responde em português brasileiro
   - Usa linguagem clara e acessível

2. CONTEXTO DO NEGÓCIO:
   ${context?.businessInfo ? `- Empresa: ${context.businessInfo.name || 'Nossa empresa'}` : ''}
   ${context?.businessInfo ? `- Setor: ${context.businessInfo.sector || 'Atendimento ao cliente'}` : ''}

3. INFORMAÇÕES DO CLIENTE:
   ${context?.clientName ? `- Nome: ${context.clientName}` : '- Cliente não identificado'}
   ${context?.clientInfo ? `- Informações: ${JSON.stringify(context.clientInfo)}` : ''}

4. AÇÕES DISPONÍVEIS:
   ${context?.availableActions ? context.availableActions.join(', ') : 'Responder mensagem, transferir para humano'}

5. DIRETRIZES:
   - Seja conciso mas completo
   - Se não souber algo, seja honesto
   - Ofereça transferência para humano quando necessário
   - Identifique oportunidades de vendas ou suporte
   - Extraia informações importantes (nome, telefone, email, interesse)

6. FORMATO DE RESPOSTA:
   Responda com JSON válido:
   {
     "message": "sua_resposta_aqui",
     "intent": "categoria_da_intenção",
     "confidence": 0.95,
     "suggestedActions": [
       {
         "type": "transfer_to_human|create_lead|schedule_callback|send_document",
         "label": "Descrição da ação",
         "data": {}
       }
     ]
   }
`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Últimas 10 mensagens para contexto
      { role: 'user', content: userMessage },
    ];

    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      // Fallback se a resposta não for JSON válido
      return {
        message: response.choices[0].message.content,
        intent: 'general_inquiry',
        confidence: 0.8,
      };
    }
  }

  async generateAutomationMessage(
    template: string,
    variables: Record<string, any>,
    context?: {
      tone?: 'formal' | 'casual' | 'friendly';
      purpose?: string;
      maxLength?: number;
    }
  ): Promise<string> {
    const prompt = `
Gere uma mensagem personalizada baseada no template e variáveis fornecidas:

Template: "${template}"
Variáveis: ${JSON.stringify(variables)}

Contexto:
- Tom: ${context?.tone || 'friendly'}
- Propósito: ${context?.purpose || 'comunicação geral'}
- Tamanho máximo: ${context?.maxLength || 500} caracteres

Diretrizes:
1. Substitua as variáveis pelos valores fornecidos
2. Mantenha o tom especificado
3. Seja natural e conversacional
4. Inclua emojis apropriados se o tom for casual/friendly
5. Respeite o limite de caracteres

Responda APENAS com a mensagem final, sem explicações.
`;

    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em comunicação e marketing. Gere mensagens personalizadas e envolventes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: Math.min(context?.maxLength || 500, 500),
    });

    return response.choices[0].message.content.trim();
  }

  async extractContactInfo(text: string): Promise<{
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    intent?: string;
  }> {
    const prompt = `
Extraia informações de contato do seguinte texto:

"${text}"

Responda APENAS com JSON válido:
{
  "name": "nome_extraído_ou_null",
  "phone": "telefone_extraído_ou_null",
  "email": "email_extraído_ou_null",
  "company": "empresa_extraída_ou_null",
  "intent": "intenção_principal_do_usuário"
}
`;

    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em extração de informações de contato. Responda sempre com JSON válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return {};
    }
  }
}

// Singleton instance
let openAIInstance: OpenAIAPI | null = null;

export const getOpenAI = (config?: OpenAIConfig): OpenAIAPI => {
  if (!openAIInstance && config) {
    openAIInstance = new OpenAIAPI(config);
  }
  return openAIInstance!;
};

export const initializeOpenAI = (apiKey: string, options?: Partial<OpenAIConfig>): OpenAIAPI => {
  openAIInstance = new OpenAIAPI({
    apiKey,
    ...options,
  });
  return openAIInstance;
};