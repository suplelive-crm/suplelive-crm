// Shared Baselinker API helpers for Edge Functions
// This file is imported by multiple Edge Functions

const BASELINKER_API_URL = 'https://api.baselinker.com/connector.php';

export interface BaselinkerConfig {
  token: string;
}

export interface BaselinkerResponse<T = any> {
  status: 'SUCCESS' | 'ERROR';
  error_code?: string;
  error_message?: string;
  [key: string]: any;
}

export interface JournalEvent {
  log_id: number;
  log_type: number;
  order_id: number;
  date: number;
  [key: string]: any;
}

export interface BaselinkerOrder {
  order_id: number;
  order_status_id: number;
  date_add: number;
  date_confirmed: number;
  date_in_status: number;
  user_login: string;
  phone: string;
  email: string;
  user_comments: string;
  admin_comments: string;
  currency: string;
  payment_method: string;
  payment_method_cod: boolean;
  payment_done: number;
  delivery_method: string;
  delivery_price: number;
  delivery_fullname: string;
  delivery_company: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_postcode: string;
  delivery_country_code: string;
  delivery_point_name: string;
  delivery_point_address: string;
  delivery_point_postcode: string;
  delivery_point_city: string;
  invoice_fullname: string;
  invoice_company: string;
  invoice_nip: string;
  invoice_address: string;
  invoice_city: string;
  invoice_state: string;
  invoice_postcode: string;
  invoice_country_code: string;
  want_invoice: boolean;
  extra_field_1: string;
  extra_field_2: string;
  order_source: string;
  order_source_id: number;
  order_source_info: string;
  order_page: string;
  pick_state: number;
  pack_state: number;
  products: BaselinkerProduct[];
  [key: string]: any;
}

export interface BaselinkerProduct {
  order_product_id: number;
  storage_id: string;
  product_id: string;
  variant_id: string;
  name: string;
  sku: string;
  ean: string;
  location: string;
  warehouse_id: number;
  attributes: string;
  price_brutto: number;
  tax_rate: number;
  quantity: number;
  weight: number;
  [key: string]: any;
}

/**
 * Make a request to Baselinker API
 */
export async function baselinkerRequest<T = any>(
  config: BaselinkerConfig,
  method: string,
  parameters: Record<string, any> = {}
): Promise<T> {
  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(parameters),
  });

  const response = await fetch(BASELINKER_API_URL, {
    method: 'POST',
    headers: {
      'X-BLToken': config.token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Baselinker API error: ${response.status} ${response.statusText}`);
  }

  const data: BaselinkerResponse<T> = await response.json();

  if (data.status === 'ERROR') {
    throw new Error(`Baselinker error: ${data.error_message} (${data.error_code})`);
  }

  return data as T;
}

/**
 * Fetch events from Baselinker Journal
 */
export async function fetchJournalEvents(
  config: BaselinkerConfig,
  lastLogId: number = 0,
  logsTypes?: number[]
): Promise<JournalEvent[]> {
  const parameters: Record<string, any> = {};

  if (lastLogId > 0) {
    parameters.last_log_id = lastLogId;
  }

  if (logsTypes && logsTypes.length > 0) {
    parameters.logs_types = logsTypes;
  }

  const response = await baselinkerRequest<{ logs: JournalEvent[] }>(
    config,
    'getJournalList',
    parameters
  );

  return response.logs || [];
}

/**
 * Fetch full order details from Baselinker
 */
export async function fetchOrderDetails(
  config: BaselinkerConfig,
  orderId: number
): Promise<BaselinkerOrder | null> {
  const response = await baselinkerRequest<{ orders: BaselinkerOrder[] }>(
    config,
    'getOrders',
    {
      order_id: orderId,
    }
  );

  return response.orders?.[0] || null;
}

/**
 * Fetch multiple orders by date range
 */
export async function fetchOrdersByDate(
  config: BaselinkerConfig,
  dateFrom: number,
  dateTo?: number
): Promise<BaselinkerOrder[]> {
  const parameters: Record<string, any> = {
    date_from: dateFrom,
  };

  if (dateTo) {
    parameters.date_to = dateTo;
  }

  const response = await baselinkerRequest<{ orders: BaselinkerOrder[] }>(
    config,
    'getOrders',
    parameters
  );

  return response.orders || [];
}

/**
 * Fetch product details
 */
export async function fetchProductDetails(
  config: BaselinkerConfig,
  productId: number,
  storageId: string = 'bl_1'
): Promise<any> {
  const response = await baselinkerRequest(
    config,
    'getInventoryProductsData',
    {
      inventory_id: storageId,
      products: [productId],
    }
  );

  return response.products?.[productId] || null;
}

/**
 * Get event type name from ID
 */
export function getEventName(eventType: number): string {
  const eventNames: Record<number, string> = {
    1: 'order_created',
    3: 'payment_received',
    4: 'order_removed',
    5: 'order_merged',
    6: 'order_split',
    7: 'invoice_created',
    8: 'receipt_created',
    9: 'package_created',
    10: 'package_deleted',
    11: 'delivery_updated',
    12: 'product_added',
    13: 'product_edited',
    14: 'product_removed',
    15: 'buyer_blacklisted',
    17: 'order_copied',
    18: 'status_changed',
    19: 'invoice_corrected',
    20: 'receipt_printed',
    21: 'invoice_cancelled',
  };

  return eventNames[eventType] || `unknown_event_${eventType}`;
}

/**
 * Format phone number to Brazilian standard
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // If starts with country code, keep it
  if (cleaned.startsWith('55')) {
    return cleaned;
  }

  // Add Brazil country code if missing
  return `55${cleaned}`;
}

/**
 * Extract CPF from Baselinker order data
 */
export function extractCPF(order: BaselinkerOrder): string | null {
  // Try invoice NIP first
  if (order.invoice_nip && order.invoice_nip.length >= 11) {
    return order.invoice_nip.replace(/\D/g, '');
  }

  // Try extra fields
  if (order.extra_field_1 && /^\d{11}$/.test(order.extra_field_1.replace(/\D/g, ''))) {
    return order.extra_field_1.replace(/\D/g, '');
  }

  if (order.extra_field_2 && /^\d{11}$/.test(order.extra_field_2.replace(/\D/g, ''))) {
    return order.extra_field_2.replace(/\D/g, '');
  }

  return null;
}

/**
 * Rate limiter for Baselinker API (100 requests per minute)
 */
export class BaselinkerRateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 95; // Keep some buffer
  private readonly windowMs = 60000; // 1 minute

  async throttle(): Promise<void> {
    const now = Date.now();

    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      // Wait until oldest request is older than 1 minute
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.throttle(); // Recursive call after waiting
    }

    this.requests.push(now);
  }
}

// Export singleton instance
export const rateLimiter = new BaselinkerRateLimiter();
