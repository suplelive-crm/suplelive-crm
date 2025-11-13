export interface BaselinkerConfig {
  apiKey: string;
  syncInterval: number;
  syncOrders: boolean;
  syncCustomers: boolean;
  syncInventory: boolean;
  orderStatuses: string[];
  inventoryId: string;
}

export interface BaselinkerResponse<T = any> {
  status: 'SUCCESS' | 'ERROR';
  error_message?: string;
  error_code?: string;
  execution_time?: number;
  data?: T;
}

export class BaselinkerAPI {
  private proxyUrl: string;
  private supabaseAnonKey: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 segundo entre requisições
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minuto de cache

  constructor(supabaseFunctionsUrl: string, supabaseAnonKey: string) {
    this.proxyUrl = `${supabaseFunctionsUrl}/functions/v1/baselinker-proxy`;
    this.supabaseAnonKey = supabaseAnonKey;
  }

  // Cache helper
  private getCacheKey(apiKey: string, method: string, parameters: Record<string, any>): string {
    return `${apiKey.substring(0, 8)}_${method}_${JSON.stringify(parameters)}`;
  }

  private getFromCache<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`[CACHE HIT] ${cacheKey}`);
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(cacheKey);
    }
    return null;
  }

  private setCache(cacheKey: string, data: any): void {
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  // Queue processing
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }

      const requestFn = this.requestQueue.shift();
      if (requestFn) {
        this.lastRequestTime = Date.now();
        await requestFn();
      }
    }

    this.isProcessingQueue = false;
  }

  private async makeRequest<T>(
    apiKey: string,
    method: string,
    parameters: Record<string, any> = {},
    useCache: boolean = true
  ): Promise<T> {
    // Verificar cache primeiro
    const cacheKey = this.getCacheKey(apiKey, method, parameters);
    if (useCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Criar promise para a requisição
    return new Promise<T>((resolve, reject) => {
      const requestFn = async () => {
        try {
          console.log(`[API REQUEST] ${method}`, { apiKey: apiKey.substring(0, 5) + '...', parameters });

          // Aguardar rate limit
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLastRequest));
          }

          this.lastRequestTime = Date.now();

          const response = await fetch(this.proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.supabaseAnonKey}`
            },
            body: JSON.stringify({
              apiKey,
              method,
              parameters
            }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('HTTP error! status: 401 - Unauthorized. Verifique a chave anônima (anon key) da Supabase.');
            } else if (response.status === 403) {
              throw new Error('HTTP error! status: 403 - Forbidden. Permissão negada para acessar a função da Supabase.');
            } else {
              const errorText = await response.text();
              throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
          }

          const result = await response.json();
          console.log(`[API RESPONSE] ${method}:`, result);

          if (result.status === 'ERROR') {
            // Detectar rate limit error
            if (result.error_message?.includes('Query limit exceeded') ||
                result.error_message?.includes('token blocked')) {
              throw new Error(result.error_message || 'Rate limit exceeded');
            }
            throw new Error(result.error_message || 'Unknown Baselinker API error');
          }

          // Salvar no cache
          if (useCache) {
            this.setCache(cacheKey, result);
          }

          resolve(result);
        } catch (error: any) {
          console.error('[API ERROR]', error);
          reject(error);
        }
      };

      // Executar imediatamente (rate limit já está dentro do requestFn)
      requestFn();
    });
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log('[CACHE] Cache cleared');
  }

  // Test connection (sem cache, sempre fresco)
  async testConnection(apiKey: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log("[TEST CONNECTION] Testing with API key:", apiKey.substring(0, 8) + '...');

      // Usar getInventories ao invés de getJournalList (mais leve)
      const result = await this.makeRequest<BaselinkerResponse>(
        apiKey,
        'getInventories',
        {},
        false // NÃO usar cache para teste de conexão
      );

      console.log("[TEST CONNECTION] Success:", result);
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error("[TEST CONNECTION] Error:", error);

      // Mensagem mais amigável para rate limit
      if (error.message?.includes('Query limit exceeded') ||
          error.message?.includes('token blocked')) {
        const match = error.message.match(/until (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        const until = match ? match[1] : 'alguns minutos';
        return {
          success: false,
          message: `Token temporariamente bloqueado devido a muitas requisições. Aguarde até ${until} e tente novamente.`
        };
      }

      return {
        success: false,
        message: error.message
      };
    }
  }

  // Orders methods
  async getOrders(apiKey: string, parameters: {
    date_from?: number;
    date_to?: number;
    order_status_id?: string;
    filter_email?: string;
    filter_order_source?: string;
    page?: number;
    get_unconfirmed_orders?: boolean;
  } = {}): Promise<any> {
    console.log("Getting orders with API key:", apiKey, "and parameters:", parameters);
    return this.makeRequest(apiKey, 'getOrders', parameters);
  }

  async getOrderDetails(apiKey: string, order_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getOrderDetails', { order_id });
  }

  async getOrderStatusList(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getOrderStatusList');
  }

  async getOrderSources(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getOrderSources');
  }

  async getOrderPaymentsHistory(apiKey: string, parameters: {
    order_id?: string;
    payment_id?: string;
    date_from?: number;
    date_to?: number;
    page?: number;
  } = {}): Promise<any> {
    return this.makeRequest(apiKey, 'getOrderPaymentsHistory', parameters);
  }

  // Inventory methods
  async getInventories(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getInventories');
  }

  async getInventoryWarehouses(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryWarehouses', {});
  }

  async getInventoryProductsList(apiKey: string, parameters: {
    inventory_id: string;
    filter_category_id?: string;
    filter_ean?: string;
    filter_sku?: string;
    filter_name?: string;
    filter_price_from?: number;
    filter_price_to?: number;
    filter_stock_from?: number;
    filter_stock_to?: number;
    page?: number;
    filter_sort?: string;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryProductsList', parameters);
  }

  async getInventoryProductsData(apiKey: string, parameters: {
    inventory_id: string;
    products: string[];
  }): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryProductsData', parameters);
  }

  async getInventoryAvailableTextFields(apiKey: string, inventory_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryAvailableTextFields', { inventory_id });
  }

  async getInventoryIntegrations(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryIntegrations');
  }

  async getInventoryCategories(apiKey: string, inventory_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryCategories', { inventory_id });
  }

  async getInventoryExtraFields(apiKey: string, inventory_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryExtraFields', { inventory_id });
  }

  async getInventoryProductsPrices(apiKey: string, parameters: {
    inventory_id: string;
    page?: number;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryProductsPrices', parameters);
  }

  async getInventoryProductsQuantity(apiKey: string, parameters: {
    inventory_id: string;
    page?: number;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'getInventoryProductsQuantity', parameters);
  }

  async updateInventoryProductsQuantity(apiKey: string, parameters: {
    inventory_id: string;
    products: Record<string, { stock: number; warn_level?: number; bl_id?: string }>;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'updateInventoryProductsQuantity', parameters);
  }

  // Helper methods for stock management
  async addProductQuantity(apiKey: string, parameters: {
    inventory_id: string;
    product_id: string;
    variant_id?: string;
    quantity: number;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'addInventoryProductsQuantity', {
      inventory_id: parameters.inventory_id,
      products: {
        [parameters.product_id]: {
          [parameters.variant_id || '0']: {
            quantity: parameters.quantity
          }
        }
      }
    });
  }

  async removeProductQuantity(apiKey: string, parameters: {
    inventory_id: string;
    product_id: string;
    variant_id?: string;
    quantity: number;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'removeInventoryProductsQuantity', {
      inventory_id: parameters.inventory_id,
      products: {
        [parameters.product_id]: {
          [parameters.variant_id || '0']: {
            quantity: parameters.quantity
          }
        }
      }
    });
  }

  // Product catalog methods
  async getProductsList(apiKey: string, parameters: {
    filter_category_id?: string;
    filter_ean?: string;
    filter_sku?: string;
    filter_name?: string;
    filter_price_from?: number;
    filter_price_to?: number;
    page?: number;
    filter_sort?: string;
  } = {}): Promise<any> {
    return this.makeRequest(apiKey, 'getProductsList', parameters);
  }

  async getProductDetails(apiKey: string, product_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getProductDetails', { product_id });
  }

  async getProductsData(apiKey: string, products: string[]): Promise<any> {
    return this.makeRequest(apiKey, 'getProductsData', { products });
  }

  async getProductsPrices(apiKey: string, page?: number): Promise<any> {
    return this.makeRequest(apiKey, 'getProductsPrices', { page });
  }

  async getProductsQuantity(apiKey: string, page?: number): Promise<any> {
    return this.makeRequest(apiKey, 'getProductsQuantity', { page });
  }

  // Journal methods
  async getJournalList(apiKey: string, parameters: {
    last_log_id: number;
    logs_types: string[];
    limit?: number;
  }): Promise<any> {
    return this.makeRequest(apiKey, 'getJournalList', parameters);
  }

  // Utility methods
  async getRequestsList(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getRequestsList');
  }

  async getRequestMessages(apiKey: string, request_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getRequestMessages', { request_id });
  }

  async getExternalStoragesList(apiKey: string): Promise<any> {
    return this.makeRequest(apiKey, 'getExternalStoragesList');
  }

  async getCategoriesList(apiKey: string, storage_id: string): Promise<any> {
    return this.makeRequest(apiKey, 'getCategoriesList', { storage_id });
  }
}

// Singleton instance
let baselinkerInstance: BaselinkerAPI | null = null;

export const getBaselinker = (): BaselinkerAPI | null => {
  return baselinkerInstance;
};

export const initializeBaselinker = (supabaseFunctionsUrl: string, supabaseAnonKey: string): BaselinkerAPI => {
  baselinkerInstance = new BaselinkerAPI(supabaseFunctionsUrl, supabaseAnonKey);
  return baselinkerInstance;
};