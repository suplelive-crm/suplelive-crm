export interface Purchase {
  id: string;
  date: string;
  carrier: 'Jadlog' | 'Correios' | string;
  storeName: string;
  customerName?: string;
  trackingCode: string;
  deliveryFee: number;
  status: string;
  estimatedDelivery?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  products: PurchaseProduct[];
  workspace_id: string;
}

export interface PurchaseProduct {
  id: string;
  purchaseId: string;
  name: string;
  quantity: number;
  cost: number;
  totalCost?: number; // Calculated field
  isVerified: boolean;
  isInStock?: boolean; // ADICIONADO: Para controlar se o produto individual está no estoque
  vencimento?: string; // ADICIONADO: Para a data de vencimento do produto (formato ISO string)
}

export interface Return {
  id: string;
  date: string;
  carrier: 'Jadlog' | 'Correios' | string;
  storeName: string;
  customerName: string;
  trackingCode: string;
  status: string;
  estimatedDelivery?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  workspace_id: string;
  observations?: string;
  is_verified: boolean;
  verification_observations?: string;
  verified_at?: string;
}

export interface Transfer {
  id: string;
  date: string;
  carrier: 'Jadlog' | 'Correios' | string;
  storeName: string;
  customerName: string;
  trackingCode: string;
  status: string;
  estimatedDelivery?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  workspace_id: string;
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