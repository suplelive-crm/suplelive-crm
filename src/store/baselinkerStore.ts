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

      // Buscar do workspaces.settings
      const baselinkerSettings = currentWorkspace.settings?.baselinker;
      return !!(baselinkerSettings?.enabled && baselinkerSettings?.token);
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

        // Salvar no banco (workspaces.settings)
        const { data: workspace, error } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', currentWorkspace.id)
          .single();

        if (error) throw error;

        const updatedSettings = {
          ...(workspace.settings || {}),
          baselinker: {
            enabled: true,
            token: config.apiKey,
            warehouse_es: config.warehouse_es || 1,
            warehouse_sp: config.warehouse_sp || 2,
            sync_interval: config.syncInterval || 5,
            sync_orders: config.syncOrders !== false,
            sync_customers: config.syncCustomers !== false,
            sync_inventory: config.syncInventory !== false,
            inventory_id: config.inventoryId || ''
          }
        };

        await supabase
          .from('workspaces')
          .update({ settings: updatedSettings })
          .eq('id', currentWorkspace.id);

        // Atualizar workspace no store também
        useWorkspaceStore.getState().updateCurrentWorkspace({
          ...currentWorkspace,
          settings: updatedSettings
        });

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

        // DESABILITADO: Sincronização automática removida em favor de webhooks
        // get().startSyncInterval();

        // Sincronização inicial manual ao conectar
        await get().syncAll(true);
      });
    },
    
    disconnect: async () => {
      await ErrorHandler.handleAsync(async () => {
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        if (!currentWorkspace) return;

        // Remover do banco
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', currentWorkspace.id)
          .single();

        const updatedSettings = {
          ...(workspace?.settings || {}),
          baselinker: {
            enabled: false,
            token: '',
            warehouse_es: 1,
            warehouse_sp: 2
          }
        };

        await supabase
          .from('workspaces')
          .update({ settings: updatedSettings })
          .eq('id', currentWorkspace.id);

        // Atualizar workspace no store
        useWorkspaceStore.getState().updateCurrentWorkspace({
          ...currentWorkspace,
          settings: updatedSettings
        });

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
          
          // CORREÇÃO: Sincronização incremental usando order_date do último pedido
          // Buscar o último pedido sincronizado no banco
          const { data: lastOrder } = await supabase
            .from('orders')
            .select('order_date')
            .eq('workspace_id', currentWorkspace.id)
            .order('order_date', { ascending: false })
            .limit(1)
            .single();

          // Se houver último pedido, usar a data dele +1 segundo para evitar duplicatas
          // Senão, usar lastSyncTimestamp (primeira sincronização)
          const dateFrom = lastOrder
            ? Math.floor(new Date(lastOrder.order_date).getTime() / 1000) + 1
            : lastSyncTimestamp;

          console.log(`Iniciando sincronização incremental de pedidos (desde ${new Date(dateFrom * 1000).toISOString()})...`);
          if (lastOrder) {
            console.log(`Último pedido no banco: ${lastOrder.order_date}`);
          }

          // Sistema de paginação: Baselinker retorna no máximo 100 pedidos por vez
          // LIMITE: Máximo 500 pedidos por sincronização (5 páginas) para evitar sobrecarga
          const MAX_ORDERS = 500;
          const MAX_PAGES = Math.ceil(MAX_ORDERS / 100); // 5 páginas

          let allOrders: any[] = [];
          let page = 1;
          let hasMoreOrders = true;

          while (hasMoreOrders && page <= MAX_PAGES) {
            const parametersToSync = {
              date_from: dateFrom, // Usar data incremental
              status_id: statusIdsToSync.join(','),
              page: page
            };

            console.log(`[PÁGINA ${page}/${MAX_PAGES}] Buscando pedidos...`, parametersToSync);
            const response = await baselinker.getOrders(config.apiKey, parametersToSync);

            const orders = response.orders || [];
            console.log(`[PÁGINA ${page}/${MAX_PAGES}] Encontrados ${orders.length} pedidos`);

            if (orders.length === 0) {
              // Não há mais pedidos
              hasMoreOrders = false;
            } else {
              allOrders.push(...orders);

              // Verificar se atingiu o limite
              if (allOrders.length >= MAX_ORDERS) {
                hasMoreOrders = false;
                console.log(`⚠️ LIMITE ATINGIDO: ${allOrders.length} pedidos (máximo ${MAX_ORDERS})`);
              }
              // Se retornou exatamente 100, provavelmente há mais pedidos
              else if (orders.length === 100) {
                page++;
                console.log(`[PÁGINA ${page}] Continuando para próxima página (100 pedidos encontrados)...`);
              } else {
                // Menos de 100 pedidos = última página
                hasMoreOrders = false;
                console.log(`[PÁGINA ${page}] Última página (${orders.length} pedidos)`);
              }
            }
          }

          if (allOrders.length >= MAX_ORDERS) {
            console.log(`⚠️ AVISO: Foram buscados ${MAX_ORDERS} pedidos (limite). Execute sincronização novamente para buscar pedidos mais antigos.`);
          }

          console.log(`✅ TOTAL: ${allOrders.length} pedidos encontrados em ${page} página(s)`);
          const orders = allOrders;
          
          for (const order of orders) {
            // Order details are already included in the getOrders response
            const orderData = order;
            
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

            // CORREÇÃO: Verificar duplicatas usando order_id_base
            const { data: existingOrder, error: checkError } = await supabase
              .from('orders')
              .select('id')
              .eq('order_id_base', parseInt(order.order_id))
              .eq('workspace_id', currentWorkspace.id)
              .maybeSingle();

            if (checkError) {
              console.error('Error checking existing order:', checkError);
              continue; // Pula este pedido
            }

            if (existingOrder) {
              // Pedido já existe, apenas atualizar status e metadata
              // Calcular total_amount a partir dos dados do Baselinker
              const paymentDone = parseFloat(orderData.payment_done || 0);
              const totalAmount = !isNaN(paymentDone) && paymentDone > 0 ? paymentDone : 0;

              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  total_amount: totalAmount,
                  status,
                  metadata: { baselinker_data: orderData }
                })
                .eq('id', existingOrder.id);

              if (updateError) {
                console.error('Error updating order:', updateError);
              }
            } else {
              // Calcular total_amount a partir dos dados do Baselinker
              // payment_done = valor total pago (com frete)
              // delivery_price = valor do frete
              // Valor líquido dos produtos = payment_done - delivery_price
              const paymentDone = parseFloat(orderData.payment_done || 0);
              const deliveryPrice = parseFloat(orderData.delivery_price || 0);
              const totalAmount = !isNaN(paymentDone) && paymentDone > 0 ? paymentDone : 0;

              const { error: insertError } = await supabase
                .from('orders')
                .insert({
                  workspace_id: currentWorkspace.id,
                  client_id: clientId,
                  total_amount: totalAmount, // Valor total com frete
                  order_date: new Date(order.date_add * 1000).toISOString(),
                  status,
                  external_id: order.order_id,
                  order_id_base: parseInt(order.order_id),
                  metadata: { baselinker_data: orderData },
                  metadata_feita: false
                });

              if (insertError) {
                console.error('❌ ERROR INSERTING ORDER:', {
                  errorMessage: insertError.message,
                  errorCode: insertError.code,
                  errorDetails: insertError.details,
                  errorHint: insertError.hint,
                  fullError: insertError,
                  orderData: {
                    order_id: order.order_id,
                    original_price: order.price,
                    parsed_price: totalAmount,
                    valid_price: validTotalAmount
                  },
                  attemptedData: {
                    workspace_id: currentWorkspace.id,
                    client_id: clientId,
                    total_amount: validTotalAmount,
                    order_date: new Date(order.date_add * 1000).toISOString(),
                    status,
                    external_id: order.order_id,
                    order_id_base: parseInt(order.order_id),
                    metadata: { baselinker_data: orderData },
                    metadata_feita: false
                  }
                });
              }
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

          // Avisar usuário se atingiu o limite
          if (allOrders.length >= MAX_ORDERS) {
            ErrorHandler.showError(
              `Limite de ${MAX_ORDERS} pedidos atingido. Execute a sincronização novamente para buscar pedidos mais antigos.`,
              'Sincronização Parcial'
            );
          }
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
            // Order details are already included in the getOrders response
            const orderData = order;
            
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

            // Baselinker returns products as an object, not array
            const productsObj = response.products || {};
            const products = Object.values(productsObj);
            allProducts.push(...products);

            hasMore = products.length > 0;
            page++;

            if (page > 10) break;
          }
          
          console.log(`Found ${allProducts.length} products to sync`);

          // Get warehouses for mapping
          const { data: warehouses } = await supabase
            .from('baselinker_warehouses')
            .select('*')
            .eq('workspace_id', currentWorkspace.id);

          const warehouseMap = new Map();
          warehouses?.forEach(wh => {
            warehouseMap.set(wh.warehouse_id, wh);
          });

          for (const product of allProducts) {
            const productDetails = await baselinker.getInventoryProductsData(config.apiKey, {
              inventory_id: config.inventoryId,
              products: [product.id]
            });

            const productData = productDetails.products?.[product.id];

            if (!productData) continue;

            // Get stock per warehouse from Baselinker
            // productData.stock is an object like { "123": 50, "456": 30 }
            const stockByWarehouse = productData.stock || {};

            // CORREÇÃO: Criar apenas UM produto por SKU (não um por warehouse)
            // Primeiro, verificar se já existe um produto com este SKU
            const { data: existingProducts, error: queryError } = await supabase
              .from('products')
              .select('id, warehouseID')
              .eq('sku', product.sku)
              .eq('workspace_id', currentWorkspace.id)
              .limit(1);

            if (queryError) {
              console.error('Error querying product:', queryError);
              continue;
            }

            // Pegar o primeiro warehouse disponível como padrão para warehouseID
            const firstWarehouseId = Object.keys(stockByWarehouse)[0] || '';
            const firstStockQuantity = Object.values(stockByWarehouse)[0] ?? 0; // Usar ?? para preservar valores negativos

            // Extrair preço de venda (primeiro item de prices)
            const pricesObj = productData?.prices || {};
            const priceValue = Object.values(pricesObj)[0] || product.price || 0;

            // Extrair custo médio
            const averageCost = parseFloat(productData?.average_cost || 0);

            // Extrair duração do produto
            const duracao = parseFloat(productData?.extra_field_63429 || 0);

            const productRecord = {
              name: product.name || productData.name,
              sku: product.sku,
              ean: product.ean,
              price: parseFloat(priceValue),
              custo: averageCost,
              duracao: duracao,
              stock_es: typeof firstStockQuantity === 'number' ? firstStockQuantity : parseInt(firstStockQuantity as string, 10), // Preservar valores negativos
              warehouseID: firstWarehouseId, // Warehouse padrão
              description: productData?.text_fields?.description || '',
              images: productData?.images || [],
              metadata: {
                baselinker_data: productData,
                baselinker_product_id: product.id
              }
            };

            let productId: string;

            if (existingProducts && existingProducts.length > 0) {
              // Update existing product
              const { error: updateError } = await supabase
                .from('products')
                .update(productRecord)
                .eq('id', existingProducts[0].id);

              if (updateError) {
                console.error('Error updating product:', updateError);
                continue;
              }

              productId = existingProducts[0].id;
            } else {
              // Insert new product
              const { data: newProduct, error: insertError } = await supabase
                .from('products')
                .insert({
                  ...productRecord,
                  external_id: product.id.toString(),
                  workspace_id: currentWorkspace.id,
                })
                .select('id')
                .single();

              if (insertError) {
                console.error('Error inserting product:', insertError);
                continue;
              }

              productId = newProduct?.id || '';
            }

            // NOVO SISTEMA: Salvar estoque de TODOS os warehouses na tabela dinâmica
            // Usando RPC function para logging automático
            if (productId) {
              for (const [warehouseId, stockQuantity] of Object.entries(stockByWarehouse)) {
                const stockQty = typeof stockQuantity === 'number' ? stockQuantity : parseInt(stockQuantity as string, 10);

                const { error: stockError } = await supabase.rpc('upsert_product_stock_with_log', {
                  p_workspace_id: currentWorkspace.id,
                  p_product_id: productId,
                  p_warehouse_id: warehouseId,
                  p_sku: product.sku,
                  p_ean: product.ean || null,
                  p_product_name: product.name || productData?.name || product.sku,
                  p_cost: averageCost || null,
                  p_price: parseFloat(priceValue) || null,
                  p_duracao: duracao || null,
                  p_stock_quantity: stockQty,
                  p_source: 'baselinker',
                  p_action_type: 'sync',
                  p_change_reason: 'Sincronização automática do Baselinker'
                });

                if (stockError) {
                  console.error('Error upserting stock with log:', stockError);
                }
              }
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
          // NOTE: Orders doesn't have workspace_id, filter through clients
          supabase.from('orders').select('*, clients!inner(workspace_id)', { count: 'exact', head: true })
            .eq('clients.workspace_id', currentWorkspace.id)
            .not('external_id', 'is', null),
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
