import { create } from 'zustand';
import { BaselinkerAPI, BaselinkerConfig, initializeBaselinker, getBaselinker } from '@/lib/baselinker-api';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

interface Product {
  id: string;
  name: string;
  sku: string;
  ean: string;
  price: number;
  stock: number;
  category_id: string;
  images: string[];
  description: string;
  attributes: Record<string, string>;
  variants: any[];
  created_at: string;
  updated_at: string;
}

interface BaselinkerState {
  config: BaselinkerConfig | null;
  products: Product[];
  loading: boolean;
  syncInProgress: boolean;
  lastSyncTime: Date | null;
  
  // Connection methods
  isConnected: () => boolean;
  connect: (config: BaselinkerConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: (apiKey: string) => Promise<{ success: boolean; message?: string; data?: any }>;
  
  // Data fetching methods
  getInventories: () => Promise<any[]>;
  getOrderStatuses: () => Promise<any[]>;
  getProducts: (inventoryId: string) => Promise<Product[]>;
  
  // Sync methods
  syncOrders: (forceFullSync?: boolean) => Promise<void>;
  syncCustomers: (forceFullSync?: boolean) => Promise<void>;
  syncInventory: () => Promise<void>;
  syncAll: (forceFullSync?: boolean) => Promise<void>;
  getSyncStats: () => Promise<{
    lastSync: Date | null;
    ordersCount: number;
    customersCount: number;
    productsCount: number;
  }>;
  
  // Utility methods
  startSyncInterval: () => void;
  stopSyncInterval: () => void;
}

export const useBaselinkerStore = create<BaselinkerState>((set, get) => {
  // Interval reference for cleanup
  let syncIntervalId: number | null = null;
  
  return {
    config: null,
    products: [],
    loading: false,
    syncInProgress: false,
    lastSyncTime: null,
    
    isConnected: () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return false;
      const savedConfig = localStorage.getItem(`baselinker_config_${currentWorkspace.id}`);
      return !!savedConfig && !!JSON.parse(savedConfig).apiKey;
    },
    
    connect: async (config: BaselinkerConfig) => {
      await ErrorHandler.handleAsync(async () => {
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
        
        console.log("DEBUG (connect): Verificando chave da Supabase:", import.meta.env.VITE_SUPABASE_ANON_KEY);
        
        initializeBaselinker(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY 
        );
        
        localStorage.setItem(`baselinker_config_${currentWorkspace.id}`, JSON.stringify(config));
        set({ config });
        
        await supabase
          .from('baselinker_sync')
          .upsert({
            workspace_id: currentWorkspace.id,
            sync_status: 'idle',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workspace_id'
          });
        
        get().startSyncInterval();
        await get().syncAll(true);
      });
    },
    
    disconnect: async () => {
      await ErrorHandler.handleAsync(async () => {
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        if (!currentWorkspace) return;
        
        localStorage.removeItem(`baselinker_config_${currentWorkspace.id}`);
        get().stopSyncInterval();
        set({ config: null });
      });
    },
    
    testConnection: async (apiKey: string) => {
      try {
        console.log("Testing connection with API key:", apiKey);
        
        console.log("DEBUG (testConnection): Verificando chave da Supabase:", import.meta.env.VITE_SUPABASE_ANON_KEY);
        
        const api = new BaselinkerAPI(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );
        const result = await api.testConnection(apiKey);
        
        console.log("Test connection result:", result);
        return result;
      } catch (error: any) {
        console.error("Test connection error:", error);
        return {
          success: false,
          message: error.message || "Connection failed"
        };
      }
    },
    
    getInventories: async () => {
      return await ErrorHandler.handleAsync(async () => {
        const baselinker = getBaselinker();
        const config = get().config;
        if (!baselinker || !config) throw new Error('Baselinker não inicializado');
        
        try {
          console.log("Getting inventories with API key:", config.apiKey);
          const response = await baselinker.getInventories(config.apiKey);
          console.log("Inventories response:", response);
          return response.inventories || [];
        } catch (error: any) {
          console.error("Error fetching inventories:", error);
          if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Invalid API key')) {
            throw new Error('Chave da API inválida ou sem permissões necessárias. Verifique sua chave da API no painel Baselinker.');
          }
          throw error;
        }
      }) || [];
    },
    
    getOrderStatuses: async () => {
      return await ErrorHandler.handleAsync(async () => {
        const baselinker = getBaselinker();
        const config = get().config;
        if (!baselinker || !config) throw new Error('Baselinker não inicializado');
        
        try {
          console.log("Getting order statuses with API key:", config.apiKey);
          const response = await baselinker.getOrderStatusList(config.apiKey);
          console.log("Order statuses response:", response);
          return response.statuses || [];
        } catch (error: any) {
          console.error("Error fetching order statuses:", error);
          if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Invalid API key')) {
            throw new Error('Chave da API inválida ou sem permissões necessárias. Verifique sua chave da API no painel Baselinker.');
          }
          throw error;
        }
      }) || [];
    },
    
    getProducts: async (inventoryId: string) => {
      return await ErrorHandler.handleAsync(async () => {
        const baselinker = getBaselinker();
        const config = get().config;
        if (!baselinker || !config) throw new Error('Baselinker não inicializado');
        
        try {
          console.log("Getting products with API key:", config.apiKey, "and inventory ID:", inventoryId);
          const response = await baselinker.getInventoryProductsList(config.apiKey, {
            inventory_id: inventoryId,
            page: 1
          });
          
          console.log("Products response:", response);
          return response.products || [];
        } catch (error: any) {
          console.error("Error fetching products:", error);
          if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Invalid API key')) {
            throw new Error('Chave da API inválida ou sem permissões necessárias. Verifique sua chave da API no painel Baselinker.');
          }
          throw error;
        }
      }) || [];
    },
    
    syncOrders: async (forceFullSync = false) => {
      await ErrorHandler.handleAsync(async () => {
        const baselinker = getBaselinker();
        const config = get().config;
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        
        if (!baselinker || !config || !currentWorkspace) {
          throw new Error('Configuração incompleta');
        }
        
        set({ syncInProgress: true });
        
        try {
          const { data: syncData } = await supabase
            .from('baselinker_sync')
            .select('last_orders_sync')
            .eq('workspace_id', currentWorkspace.id)
            .maybeSingle();
          
          const lastSyncTimestamp = (syncData?.last_orders_sync && !forceFullSync)
            ? new Date(syncData.last_orders_sync).getTime() / 1000 
            : 0;

          const statusListResponse = await baselinker.getOrderStatusList(config.apiKey);
          const allStatusesFromBaselinker = statusListResponse.statuses || [];
          const statusNamesToSync = config.orderStatuses;
          const statusIdsToSync = allStatusesFromBaselinker
            .filter(statusInfo => statusNamesToSync.includes(statusInfo.name.toLowerCase().replace(/\s+/g, '_')))
            .map(statusInfo => statusInfo.id);
          
          const parametersToSync = {
            date_from: lastSyncTimestamp,
            status_id: statusIdsToSync.join(',')
          };

          console.log("DEBUG: Parâmetros REAIS enviados para getOrders:", parametersToSync);
          const response = await baselinker.getOrders(config.apiKey, parametersToSync);
          
          const orders = response.orders || [];
          console.log(`Found ${orders.length} orders to sync`);
          
          for (const order of orders) {
            const orderDetails = await baselinker.getOrderDetails(config.apiKey, order.order_id);
            const orderData = orderDetails;
            
            let status = 'pending';
            if (['paid', 'ready_for_shipping'].includes(order.order_status_id)) {
              status = 'processing';
            } else if (['shipped', 'delivered'].includes(order.order_status_id)) {
              status = 'completed';
            } else if (['cancelled', 'returned'].includes(order.order_status_id)) {
              status = 'cancelled';
            }
            
            let clientId = null;
            if (orderData.email || orderData.phone) {
              const { data: existingClients } = await supabase
                .from('clients')
                .select('id')
                .or(`email.eq.${orderData.email},phone.eq.${orderData.phone}`)
                .eq('workspace_id', currentWorkspace.id);
              
              if (existingClients && existingClients.length > 0) {
                clientId = existingClients[0].id;
                
                await supabase
                  .from('clients')
                  .update({
                    name: orderData.delivery_fullname || orderData.invoice_fullname,
                    email: orderData.email,
                    phone: orderData.phone,
                    metadata: {
                      baselinker_data: {
                        company: orderData.invoice_company,
                        address: orderData.delivery_address,
                        city: orderData.delivery_city,
                        postcode: orderData.delivery_postcode,
                        country: orderData.delivery_country,
                        last_order_id: order.order_id
                      }
                    }
                  })
                  .eq('id', clientId);
              } else {
                const { data: newClient } = await supabase
                  .from('clients')
                  .insert({
                    name: orderData.delivery_fullname || orderData.invoice_fullname,
                    email: orderData.email,
                    phone: orderData.phone,
                    workspace_id: currentWorkspace.id,
                    metadata: {
                      baselinker_data: {
                        company: orderData.invoice_company,
                        address: orderData.delivery_address,
                        city: orderData.delivery_city,
                        postcode: orderData.delivery_postcode,
                        country: orderData.delivery_country,
                        last_order_id: order.order_id
                      }
                    }
                  })
                  .select()
                  .single();
                
                clientId = newClient?.id;
              }
            }
            
            if (!clientId) continue;
            
            const { data: existingOrders } = await supabase
              .from('orders')
              .select('id')
              .eq('external_id', order.order_id);
            
            if (existingOrders && existingOrders.length > 0) {
              await supabase
                .from('orders')
                .update({
                  total_amount: parseFloat(order.price),
                  status,
                  metadata: { baselinker_data: orderData }
                })
                .eq('external_id', order.order_id);
            } else {
              await supabase
                .from('orders')
                .insert({
                  client_id: clientId,
                  total_amount: parseFloat(order.price),
                  order_date: new Date(order.date_add * 1000).toISOString(),
                  status,
                  external_id: order.order_id,
                  metadata: { baselinker_data: orderData }
                });
            }
          }
          
          await supabase
            .from('baselinker_sync')
            .upsert({
              workspace_id: currentWorkspace.id,
              last_orders_sync: new Date().toISOString(),
              sync_status: 'idle',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'workspace_id'
            });
          
          set({ lastSyncTime: new Date() });
        } catch (error: any) {
          if (error.message.includes('401') || error.message.includes('Unauthorized') || 
              error.message.includes('Invalid API key')) {
            throw new Error('Chave da API inválida ou sem permissões necessárias. Verifique sua chave da API no painel Baselinker.');
          }
          throw error;
        } finally {
          set({ syncInProgress: false });
        }
      });
    },
    
    syncCustomers: async (forceFullSync = false) => {
      await ErrorHandler.handleAsync(async () => {
        const baselinker = getBaselinker();
        const config = get().config;
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        
        if (!baselinker || !config || !currentWorkspace) {
          throw new Error('Configuração incompleta');
        }
        
        set({ syncInProgress: true });
        
        try {
          const { data: syncData } = await supabase
            .from('baselinker_sync')
            .select('last_customers_sync')
            .eq('workspace_id', currentWorkspace.id)
            .maybeSingle();
          
          const lastSyncTimestamp = (syncData?.last_customers_sync && !forceFullSync)
            ? new Date(syncData.last_customers_sync).getTime() / 1000 
            : 0;
          
          console.log("Syncing customers with API key:", config.apiKey);
          
          // CORREÇÃO: Assegurando que a chamada de API está correta
          const response = await baselinker.getOrders(config.apiKey, {
            date_from: lastSyncTimestamp
          });
          
          const orders = response.orders || [];
          console.log(`Found ${orders.length} orders to extract customers from`);
          
          for (const order of orders) {
            // CORREÇÃO: Assegurando que a chamada de API está correta
            const orderDetails = await baselinker.getOrderDetails(config.apiKey, order.order_id);
            const orderData = orderDetails;
            
            if (!orderData.email && !orderData.phone) continue;
            
            const { data: existingClients } = await supabase
              .from('clients')
              .select('id')
              .or(`email.eq.${orderData.email},phone.eq.${orderData.phone}`)
              .eq('workspace_id', currentWorkspace.id);
            
            if (existingClients && existingClients.length > 0) {
              await supabase
                .from('clients')
                .update({
                  name: orderData.delivery_fullname || orderData.invoice_fullname,
                  email: orderData.email,
                  phone: orderData.phone,
                  metadata: {
                    baselinker_data: {
                      company: orderData.invoice_company,
                      address: orderData.delivery_address,
                      city: orderData.delivery_city,
                      postcode: orderData.delivery_postcode,
                      country: orderData.delivery_country,
                      last_order_id: order.order_id
                    }
                  }
                })
                .eq('id', existingClients[0].id);
            } else {
              await supabase
                .from('clients')
                .insert({
                  name: orderData.delivery_fullname || orderData.invoice_fullname,
                  email: orderData.email,
                  phone: orderData.phone,
                  workspace_id: currentWorkspace.id,
                  metadata: {
                    baselinker_data: {
                      company: orderData.invoice_company,
                      address: orderData.delivery_address,
                      city: orderData.delivery_city,
                      postcode: orderData.delivery_postcode,
                      country: orderData.delivery_country,
                      last_order_id: order.order_id
                    }
                  }
                });
            }
          }
          
          await supabase
            .from('baselinker_sync')
            .upsert({
              workspace_id: currentWorkspace.id,
              last_customers_sync: new Date().toISOString(),
              sync_status: 'idle',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'workspace_id'
            });
          
          set({ lastSyncTime: new Date() });
        } catch (error: any) {
          if (error.message.includes('401') || error.message.includes('Unauthorized') || 
              error.message.includes('Invalid API key')) {
            throw new Error('Chave da API inválida ou sem permissões necessárias. Verifique sua chave da API no painel Baselinker.');
          }
          throw error;
        } finally {
          set({ syncInProgress: false });
        }
      });
    },
    
    syncInventory: async () => {
      await ErrorHandler.handleAsync(async () => {
        const baselinker = getBaselinker();
        const config = get().config;
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        
        if (!baselinker || !config || !currentWorkspace || !config.inventoryId) {
          throw new Error('Configuração incompleta');
        }
        
        set({ syncInProgress: true });
        
        try {
          console.log("Syncing inventory with API key:", config.apiKey, "and inventory ID:", config.inventoryId);
          let page = 1;
          let hasMore = true;
          const allProducts: any[] = [];
          
          while (hasMore) {
            const response = await baselinker.getInventoryProductsList(config.apiKey, {
              inventory_id: config.inventoryId,
              page
            });
            
            const products = response.products || [];
            allProducts.push(...products);
            
            hasMore = products.length > 0;
            page++;
            
            if (page > 10) break;
          }
          
          console.log(`Found ${allProducts.length} products to sync`);
          
          for (const product of allProducts) {
            const productDetails = await baselinker.getInventoryProductsData(config.apiKey, {
              inventory_id: config.inventoryId,
              products: [product.id]
            });
            
            const productData = productDetails.products?.[product.id];
            
            if (!productData) continue;
            
            const { data: existingProducts } = await supabase
              .from('products')
              .select('id')
              .eq('external_id', product.id)
              .eq('workspace_id', currentWorkspace.id);
            
            if (existingProducts && existingProducts.length > 0) {
              await supabase
                .from('products')
                .update({
                  name: product.name,
                  sku: product.sku,
                  ean: product.ean,
                  price: parseFloat(product.price),
                  stock: parseInt(product.stock),
                  description: productData?.description || '',
                  images: productData?.images || [],
                  metadata: { baselinker_data: productData },
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingProducts[0].id);
            } else {
              await supabase
                .from('products')
                .insert({
                  name: product.name,
                  sku: product.sku,
                  ean: product.ean,
                  price: parseFloat(product.price),
                  stock: parseInt(product.stock),
                  description: productData?.description || '',
                  images: productData?.images || [],
                  external_id: product.id,
                  workspace_id: currentWorkspace.id,
                  metadata: { baselinker_data: productData }
                });
            }
          }
          
          await supabase
            .from('baselinker_sync')
            .upsert({
              workspace_id: currentWorkspace.id,
              last_inventory_sync: new Date().toISOString(),
              sync_status: 'idle',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'workspace_id'
            });
          
          set({ lastSyncTime: new Date() });
        } catch (error: any) {
          if (error.message.includes('401') || error.message.includes('Unauthorized') || 
              error.message.includes('Invalid API key')) {
            throw new Error('Chave da API inválida ou sem permissões necessárias. Verifique sua chave da API no painel Baselinker.');
          }
          throw error;
        } finally {
          set({ syncInProgress: false });
        }
      });
    },
    
    syncAll: async (forceFullSync = false) => {
      await ErrorHandler.handleAsync(async () => {
        const config = get().config;
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        
        if (!config || !currentWorkspace) {
          throw new Error('Configuração incompleta');
        }
        
        await supabase
          .from('baselinker_sync')
          .upsert({
            workspace_id: currentWorkspace.id,
            sync_status: 'syncing',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workspace_id'
          });
        
        set({ syncInProgress: true });
        
        try {
          if (config.syncOrders) {
            await get().syncOrders(forceFullSync);
          }
          
          if (config.syncCustomers) {
            await get().syncCustomers(forceFullSync);
          }
          
          if (config.syncInventory && config.inventoryId) {
            await get().syncInventory();
          }
          
          await supabase
            .from('baselinker_sync')
            .upsert({
              workspace_id: currentWorkspace.id,
              sync_status: 'idle',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'workspace_id'
            });
          
          set({ lastSyncTime: new Date() });
        } catch (error: any) {
          await supabase
            .from('baselinker_sync')
            .upsert({
              workspace_id: currentWorkspace.id,
              sync_status: 'error',
              sync_errors: [{ message: error.message, timestamp: new Date().toISOString() }],
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'workspace_id'
            });
          
          throw error;
        } finally {
          set({ syncInProgress: false });
        }
      });
    },
    
    getSyncStats: async () => {
      return await ErrorHandler.handleAsync(async () => {
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        
        if (!currentWorkspace) {
          return {
            lastSync: null,
            ordersCount: 0,
            customersCount: 0,
            productsCount: 0
          };
        }
        
        const { data: syncData } = await supabase
          .from('baselinker_sync')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .maybeSingle();
        
        const [
          { count: ordersCount },
          { count: customersCount },
          { count: productsCount }
        ] = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }).not('external_id', 'is', null),
          supabase.from('clients').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id)
        ]);
        
        let lastSync = null;
        if (syncData) {
          const times = [
            syncData.last_orders_sync,
            syncData.last_customers_sync,
            syncData.last_inventory_sync
          ].filter(Boolean).map(date => new Date(date));
          
          if (times.length > 0) {
            lastSync = new Date(Math.max(...times.map(date => date.getTime())));
          }
        }
        
        return {
          lastSync,
          ordersCount: ordersCount || 0,
          customersCount: customersCount || 0,
          productsCount: productsCount || 0
        };
      }) || {
        lastSync: null,
        ordersCount: 0,
        customersCount: 0,
        productsCount: 0
      };
    },
    
    startSyncInterval: () => {
      const config = get().config;
      if (!config) return;
      
      get().stopSyncInterval();
      
      syncIntervalId = window.setInterval(() => {
        get().syncAll();
      }, config.syncInterval * 60 * 1000);
    },
    
    stopSyncInterval: () => {
      if (syncIntervalId !== null) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
    }
  };
});