import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

export interface ProductWarehouse {
  id: string;
  sku: string;
  name: string;
  warehouseID: string;
  warehouseName?: string;
  warehouseCode?: string;
  stock: number;
  cost?: number;
  price?: number;
  ean?: string;
}

export interface ProductSummary {
  sku: string;
  name: string;
  ean?: string;
  totalStock: number;
  warehouses: {
    warehouseID: string;
    warehouseName: string;
    warehouseCode: string;
    stock: number;
    cost?: number;
    price?: number;
  }[];
  avgCost?: number;
  avgPrice?: number;
}

interface InventoryState {
  products: ProductWarehouse[];
  warehouses: Map<string, { code: string; name: string }>;
  loading: boolean;
  searchQuery: string;
  selectedWarehouse: string | null;

  // Actions
  loadProducts: () => Promise<void>;
  loadWarehouses: () => Promise<void>;
  getProductSummaries: () => ProductSummary[];
  setSearchQuery: (query: string) => void;
  setSelectedWarehouse: (warehouseID: string | null) => void;
  updateProductStock: (productId: string, newStock: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  warehouses: new Map(),
  loading: false,
  searchQuery: '',
  selectedWarehouse: null,

  loadWarehouses: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) {
        throw new Error('Nenhum workspace selecionado');
      }

      const { data, error } = await supabase
        .from('baselinker_warehouses')
        .select('warehouse_id, warehouse_code, warehouse_name')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const warehouseMap = new Map<string, { code: string; name: string }>();
      data?.forEach(wh => {
        warehouseMap.set(wh.warehouse_id, {
          code: wh.warehouse_code || wh.warehouse_id,
          name: wh.warehouse_name
        });
      });

      set({ warehouses: warehouseMap });
    });
  },

  loadProducts: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) {
        throw new Error('Nenhum workspace selecionado');
      }

      set({ loading: true });

      // Load warehouses first if not loaded
      if (get().warehouses.size === 0) {
        await get().loadWarehouses();
      }

      // Buscar produtos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('sku', { ascending: true });

      if (productsError) throw productsError;

      // Buscar estoques por warehouse da nova tabela
      const { data: stockData, error: stockError } = await supabase
        .from('product_stock_by_warehouse')
        .select('product_id, warehouse_id, stock_quantity')
        .eq('workspace_id', currentWorkspace.id);

      if (stockError) {
        console.error('Error loading stock data:', stockError);
      }

      // Criar mapa de estoque: Map<product_id, Map<warehouse_id, stock>>
      const stockMap = new Map<string, Map<string, number>>();
      (stockData || []).forEach(stock => {
        if (!stockMap.has(stock.product_id)) {
          stockMap.set(stock.product_id, new Map());
        }
        stockMap.get(stock.product_id)!.set(stock.warehouse_id, stock.stock_quantity);
      });

      const warehouses = get().warehouses;

      // Map products com estoque dinâmico por warehouse
      const products: ProductWarehouse[] = (productsData || []).map(product => {
        const productStocks = stockMap.get(product.id);
        const warehouseStock = productStocks?.get(product.warehouseID) ?? product.stock_es ?? 0; // Fallback para stock_es durante migração

        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          warehouseID: product.warehouseID || '',
          warehouseName: warehouses.get(product.warehouseID)?.name || product.warehouseID,
          warehouseCode: warehouses.get(product.warehouseID)?.code || product.warehouseID,
          stock: warehouseStock,
          cost: product.cost,
          price: product.price,
          ean: product.ean,
        };
      });

      set({ products, loading: false });
    }, () => {
      set({ loading: false });
    });
  },

  getProductSummaries: () => {
    const { products, searchQuery, selectedWarehouse } = get();

    // Filter by search query
    let filteredProducts = products;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredProducts = products.filter(p =>
        p.sku.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.ean?.toLowerCase().includes(query)
      );
    }

    // Filter by warehouse
    if (selectedWarehouse) {
      filteredProducts = filteredProducts.filter(p => p.warehouseID === selectedWarehouse);
    }

    // Group by SKU
    const grouped = new Map<string, ProductSummary>();

    filteredProducts.forEach(product => {
      if (!grouped.has(product.sku)) {
        grouped.set(product.sku, {
          sku: product.sku,
          name: product.name,
          ean: product.ean,
          totalStock: 0,
          warehouses: [],
        });
      }

      const summary = grouped.get(product.sku)!;
      summary.totalStock += product.stock;
      summary.warehouses.push({
        warehouseID: product.warehouseID,
        warehouseName: product.warehouseName || product.warehouseID,
        warehouseCode: product.warehouseCode || product.warehouseID,
        stock: product.stock,
        cost: product.cost,
        price: product.price,
      });

      // Calculate average cost and price
      const costs = summary.warehouses.filter(w => w.cost).map(w => w.cost!);
      const prices = summary.warehouses.filter(w => w.price).map(w => w.price!);

      if (costs.length > 0) {
        summary.avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
      }
      if (prices.length > 0) {
        summary.avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSelectedWarehouse: (warehouseID: string | null) => {
    set({ selectedWarehouse: warehouseID });
  },

  updateProductStock: async (productId: string, newStock: number) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) {
        throw new Error('Nenhum workspace selecionado');
      }

      // Buscar informações do produto
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('sku, warehouseID')
        .eq('id', productId)
        .single();

      if (fetchError || !product) throw fetchError || new Error('Produto não encontrado');

      // Atualizar na tabela nova (product_stock_by_warehouse)
      const { error: stockError } = await supabase
        .from('product_stock_by_warehouse')
        .upsert({
          workspace_id: currentWorkspace.id,
          product_id: productId,
          warehouse_id: product.warehouseID,
          sku: product.sku,
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id,sku,warehouse_id'
        });

      if (stockError) throw stockError;

      // Atualizar também stock_es (temporário para compatibilidade)
      const { error } = await supabase
        .from('products')
        .update({ stock_es: newStock })
        .eq('id', productId);

      if (error) throw error;

      // Update local state
      set(state => ({
        products: state.products.map(p =>
          p.id === productId ? { ...p, stock: newStock } : p
        )
      }));

      ErrorHandler.showSuccess('Estoque atualizado com sucesso');
    });
  },
}));
