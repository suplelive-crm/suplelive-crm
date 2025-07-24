export interface Purchase {
  id: string;
  workspace_id: string;
  date: string;
  carrier: string;
  storeName: string;
  customer_name?: string;
  trackingCode: string;
  delivery_fee: number;
  status: string;
  estimated_delivery?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  products: PurchaseProduct[];
}

export interface PurchaseProduct {
  id: string;
  purchase_id: string;
  name: string;
  quantity: number;
  cost: number;
  total_cost?: number;
  is_verified: boolean;
  is_in_stock?: boolean;
  vencimento?: string; // ADICIONADO: Para a data de vencimento do produto (formato ISO string)
  SKU?: string;
}

export interface Return {
  id: string;
  workspace_id: string;
  date: string;
  carrier: string;
  storeName: string;
  customer_name: string;
  trackingCode: string;
  status: string;
  estimated_delivery?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  observations?: string;
  is_verified: boolean;
  verification_observations?: string;
  verified_at?: string;
}

export interface Transfer {
  id: string;
  workspace_id: string;
  date: string;
  carrier: string;
  storeName: string;
  customer_name: string;
  trackingCode: string;
  status: string;
  estimated_delivery?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type TrackingItem = Purchase | Return | Transfer;

export interface TrackingStatus {
  code: string;
  status: string;
  estimatedDelivery?: string;
  lastUpdate: string;
  history: {
    date: string;
    status: string;
    location?: string;
  }[];
}

export interface TrackingResponse {
  success: boolean;
  data?: TrackingStatus;
  error?: string;
}