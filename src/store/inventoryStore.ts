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

      // Buscar warehouses configurados
      const { data, error } = await supabase
        .from('baselinker_warehouses')
        .select('warehouse_id, warehouse_name, warehouse_code')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const warehouseMap = new Map<string, { code: string; name: string }>();

      // Se não houver warehouses cadastrados, buscar nomes únicos diretamente dos produtos
      if (!data || data.length === 0) {
        const { data: stockData } = await supabase
          .from('product_stock_by_warehouse')
          .select('warehouse_id')
          .eq('workspace_id', currentWorkspace.id);

        // Criar entradas com warehouse_id como nome temporário
        const uniqueWarehouses = [...new Set(stockData?.map(s => s.warehouse_id) || [])];
        uniqueWarehouses.forEach(whId => {
          warehouseMap.set(whId, {
            code: whId,
            name: `Warehouse ${whId}` // Nome temporário até configurar
          });
        });
      } else {
        // Usar warehouses cadastrados
        data.forEach(wh => {
          warehouseMap.set(wh.warehouse_id, {
            code: wh.warehouse_code || wh.warehouse_id,
            name: wh.warehouse_name
          });
        });
      }

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

      // Buscar DIRETAMENTE da tabela product_stock_by_warehouse
      const { data: stockData, error: stockError } = await supabase
        .from('product_stock_by_warehouse')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('sku', { ascending: true });

      if (stockError) throw stockError;

      const warehouses = get().warehouses;

      // Map products diretamente da tabela de estoque por warehouse
      const products: ProductWarehouse[] = (stockData || []).map(stock => {
        return {
          id: stock.id, // ID do registro de estoque
          sku: stock.sku,
          name: stock.product_name || stock.sku, // Usar nome cacheado ou SKU como fallback
          warehouseID: stock.warehouse_id,
          warehouseName: warehouses.get(stock.warehouse_id)?.name || stock.warehouse_id,
          warehouseCode: warehouses.get(stock.warehouse_id)?.code || stock.warehouse_id,
          stock: stock.stock_quantity,
          cost: stock.cost,
          price: stock.price,
          ean: stock.ean,
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

      // Check if this warehouse already exists in the summary
      const existingWarehouse = summary.warehouses.find(w => w.warehouseID === product.warehouseID);

      if (existingWarehouse) {
        // Update existing warehouse stock (aggregate duplicates)
        existingWarehouse.stock += product.stock;
        summary.totalStock += product.stock;
      } else {
        // Add new warehouse entry
        summary.totalStock += product.stock;
        summary.warehouses.push({
          warehouseID: product.warehouseID,
          warehouseName: product.warehouseName || product.warehouseID,
          warehouseCode: product.warehouseCode || product.warehouseID,
          stock: product.stock,
          cost: product.cost,
          price: product.price,
        });
      }

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

  updateProductStock: async (stockRecordId: string, newStock: number) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) {
        throw new Error('Nenhum workspace selecionado');
      }

      // Atualizar DIRETAMENTE na tabela product_stock_by_warehouse
      const { error: stockError } = await supabase
        .from('product_stock_by_warehouse')
        .update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockRecordId)
        .eq('workspace_id', currentWorkspace.id);

      if (stockError) throw stockError;

      // Update local state
      set(state => ({
        products: state.products.map(p =>
          p.id === stockRecordId ? { ...p, stock: newStock } : p
        )
      }));

      ErrorHandler.showSuccess('Estoque atualizado com sucesso');
    });
  },
}));
