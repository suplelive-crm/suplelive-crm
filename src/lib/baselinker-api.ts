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

  constructor(supabaseFunctionsUrl: string, supabaseAnonKey: string) {
    this.proxyUrl = `${supabaseFunctionsUrl}/functions/v1/baselinker-proxy`;
    this.supabaseAnonKey = supabaseAnonKey;
  }

  private async makeRequest<T>(
    apiKey: string,
    method: string,
    parameters: Record<string, any> = {}
  ): Promise<T> {
    try {
      console.log(`Making Baselinker API request: ${method}`, { apiKey: apiKey.substring(0, 5) + '...', parameters });

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
      console.log(`Baselinker API response for ${method}:`, result);

      if (result.status === 'ERROR') {
        throw new Error(result.error_message || 'Unknown Baselinker API error');
      }

      return result;
    } catch (error: any) {
      console.error('Baselinker API request failed:', error);
      throw error;
    }
  }

  // Test connection
  async testConnection(apiKey: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log("Testing connection with API key:", apiKey);
      const result = await this.makeRequest<BaselinkerResponse>(apiKey, 'getJournalList', {
        last_log_id: 1,
        logs_types: ['order', 'product', 'inventory'],
        limit: 1
      });

      console.log("Test connection result:", result);
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error("Test connection error:", error);
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