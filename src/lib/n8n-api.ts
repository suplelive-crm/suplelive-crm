export interface N8NConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8NNode[];
  connections: Record<string, any>;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
}

export interface N8NNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
}

export interface N8NExecution {
  id: string;
  workflowId: string;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status: 'running' | 'success' | 'error' | 'canceled';
  data?: Record<string, any>;
}

export interface N8NWebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class N8NAPI {
  private config: N8NConfig;

  constructor(config: N8NConfig) {
    this.config = config;
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Authentication
    if (this.config.apiKey) {
      headers['X-N8N-API-KEY'] = this.config.apiKey;
    } else if (this.config.username && this.config.password) {
      const auth = btoa(`${this.config.username}:${this.config.password}`);
      headers['Authorization'] = `Basic ${auth}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `N8N API Error (${response.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Falha na conexão com N8N: ${error.message}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      return true;
    } catch (error) {
      console.error('N8N health check failed:', error);
      return false;
    }
  }

  // Workflows
  async getWorkflows(): Promise<N8NWorkflow[]> {
    try {
      const response = await this.makeRequest('/workflows');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<N8NWorkflow> {
    return await this.makeRequest(`/workflows/${id}`);
  }

  async createWorkflow(workflow: Partial<N8NWorkflow>): Promise<N8NWorkflow> {
    return await this.makeRequest('/workflows', 'POST', workflow);
  }

  async updateWorkflow(id: string, workflow: Partial<N8NWorkflow>): Promise<N8NWorkflow> {
    return await this.makeRequest(`/workflows/${id}`, 'PUT', workflow);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.makeRequest(`/workflows/${id}`, 'DELETE');
  }

  async activateWorkflow(id: string): Promise<void> {
    await this.makeRequest(`/workflows/${id}/activate`, 'POST');
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.makeRequest(`/workflows/${id}/deactivate`, 'POST');
  }

  // Executions
  async executeWorkflow(
    id: string,
    data?: Record<string, any>
  ): Promise<N8NExecution> {
    return await this.makeRequest(`/workflows/${id}/execute`, 'POST', data);
  }

  async getExecutions(workflowId?: string): Promise<N8NExecution[]> {
    const endpoint = workflowId 
      ? `/executions?filter={"workflowId":"${workflowId}"}`
      : '/executions';
    const response = await this.makeRequest(endpoint);
    return response.data || [];
  }

  async getExecution(id: string): Promise<N8NExecution> {
    return await this.makeRequest(`/executions/${id}`);
  }

  // Webhooks
  async triggerWebhook(
    webhookPath: string,
    data: any,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<N8NWebhookResponse> {
    const url = `${this.config.baseUrl}/webhook/${webhookPath}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method === 'POST' ? JSON.stringify(data) : undefined,
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        // If response is not JSON, use text
        const text = await response.text();
        result = { text };
      }
      
      return {
        success: response.ok,
        data: result,
        error: response.ok ? undefined : result.message || 'Webhook execution failed',
      };
    } catch (error) {
      return {
        success: false,
        error: `Webhook error: ${error.message}`,
      };
    }
  }

  // Chatbot específico
  async processChatbotMessage(
    workflowId: string,
    message: string,
    context: {
      clientId?: string;
      conversationId?: string;
      clientInfo?: any;
      metadata?: any;
    }
  ): Promise<{
    response: string;
    actions?: Array<{
      type: string;
      data: any;
    }>;
  }> {
    const data = {
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    const execution = await this.executeWorkflow(workflowId, data);
    
    // Aguardar conclusão da execução
    let attempts = 0;
    const maxAttempts = 30; // 30 segundos
    
    while (attempts < maxAttempts) {
      const executionStatus = await this.getExecution(execution.id);
      
      if (executionStatus.status === 'success') {
        return {
          response: executionStatus.data?.response || 'Resposta processada com sucesso',
          actions: executionStatus.data?.actions || [],
        };
      } else if (executionStatus.status === 'error') {
        throw new Error('Erro no processamento do chatbot');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Timeout no processamento do chatbot');
  }

  // Text Classification
  async classifyText(
    workflowId: string,
    text: string,
    categories: string[]
  ): Promise<{
    category: string;
    confidence: number;
    metadata?: any;
  }> {
    const data = {
      text,
      categories,
      timestamp: new Date().toISOString(),
    };

    const execution = await this.executeWorkflow(workflowId, data);
    
    // Aguardar conclusão
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      const executionStatus = await this.getExecution(execution.id);
      
      if (executionStatus.status === 'success') {
        return {
          category: executionStatus.data?.category || 'unknown',
          confidence: executionStatus.data?.confidence || 0,
          metadata: executionStatus.data?.metadata,
        };
      } else if (executionStatus.status === 'error') {
        throw new Error('Erro na classificação de texto');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Timeout na classificação de texto');
  }

  // Templates para automação
  async createChatbotWorkflow(name: string, config: {
    openaiApiKey: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
  }): Promise<N8NWorkflow> {
    const workflow = {
      name,
      active: false,
      nodes: [
        {
          id: 'webhook',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            httpMethod: 'POST',
            path: `chatbot-${name.toLowerCase().replace(/\s+/g, '-')}`,
            responseMode: 'responseNode',
          },
        },
        {
          id: 'openai',
          name: 'OpenAI Chat',
          type: 'n8n-nodes-base.openAi',
          typeVersion: 1,
          position: [450, 300],
          parameters: {
            resource: 'chat',
            operation: 'message',
            model: config.model || 'gpt-3.5-turbo',
            messages: {
              messageValues: [
                {
                  role: 'system',
                  content: config.systemPrompt || 'Você é um assistente virtual útil.',
                },
                {
                  role: 'user',
                  content: '={{$json.message}}',
                },
              ],
            },
            options: {
              temperature: config.temperature || 0.7,
              maxTokens: 500,
            },
          },
          credentials: {
            openAiApi: {
              id: 'openai-credentials',
              name: 'OpenAI API',
            },
          },
        },
        {
          id: 'response',
          name: 'Response',
          type: 'n8n-nodes-base.respondToWebhook',
          typeVersion: 1,
          position: [650, 300],
          parameters: {
            respondWith: 'json',
            responseBody: '={"response": "{{$json.choices[0].message.content}}", "timestamp": "{{new Date().toISOString()}}"}',
          },
        },
      ],
      connections: {
        webhook: {
          main: [[{ node: 'openai', type: 'main', index: 0 }]],
        },
        openai: {
          main: [[{ node: 'response', type: 'main', index: 0 }]],
        },
      },
    };

    return await this.createWorkflow(workflow);
  }

  async createTextClassifierWorkflow(name: string, config: {
    openaiApiKey: string;
    categories: string[];
    model?: string;
  }): Promise<N8NWorkflow> {
    const workflow = {
      name,
      active: false,
      nodes: [
        {
          id: 'webhook',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            httpMethod: 'POST',
            path: `classifier-${name.toLowerCase().replace(/\s+/g, '-')}`,
            responseMode: 'responseNode',
          },
        },
        {
          id: 'openai',
          name: 'OpenAI Classifier',
          type: 'n8n-nodes-base.openAi',
          typeVersion: 1,
          position: [450, 300],
          parameters: {
            resource: 'chat',
            operation: 'message',
            model: config.model || 'gpt-3.5-turbo',
            messages: {
              messageValues: [
                {
                  role: 'system',
                  content: `Classifique o texto em uma das categorias: ${config.categories.join(', ')}. Responda apenas com JSON: {"category": "categoria", "confidence": 0.95}`,
                },
                {
                  role: 'user',
                  content: '={{$json.text}}',
                },
              ],
            },
            options: {
              temperature: 0.1,
              maxTokens: 100,
            },
          },
          credentials: {
            openAiApi: {
              id: 'openai-credentials',
              name: 'OpenAI API',
            },
          },
        },
        {
          id: 'response',
          name: 'Response',
          type: 'n8n-nodes-base.respondToWebhook',
          typeVersion: 1,
          position: [650, 300],
          parameters: {
            respondWith: 'json',
            responseBody: '={{JSON.parse($json.choices[0].message.content)}}',
          },
        },
      ],
      connections: {
        webhook: {
          main: [[{ node: 'openai', type: 'main', index: 0 }]],
        },
        openai: {
          main: [[{ node: 'response', type: 'main', index: 0 }]],
        },
      },
    };

    return await this.createWorkflow(workflow);
  }
}

// Singleton instance
let n8nInstance: N8NAPI | null = null;

export const getN8N = (): N8NAPI | null => {
  return n8nInstance;
};

export const initializeN8N = (config: N8NConfig): N8NAPI => {
  n8nInstance = new N8NAPI(config);
  return n8nInstance;
};