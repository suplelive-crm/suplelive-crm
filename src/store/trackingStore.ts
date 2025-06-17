import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';
import { Purchase, PurchaseProduct, Return, Transfer, TrackingResponse } from '@/types/tracking';
import { trackPackage, parseTrackingResponse, getTrackingUrl } from '@/lib/tracking-api';

// IMPORTANTE: Certifique-se que seu tipo PurchaseProduct em '@/types/tracking'
// inclui as propriedades 'isVerified: boolean;', 'isInStock?: boolean;' e 'vencimento?: string;'.
// E que seu banco de dados Supabase usa os nomes de coluna EXATOS como
// 'storeName', 'customerName', 'trackingCode', 'deliveryFee', 'estimatedDelivery', 'isArchived',
// 'isVerified', 'isInStock', 'vencimento', 'sku'.

interface TrackingState {
  // Data
  purchases: Purchase[];
  returns: Return[];
  transfers: Transfer[];

  // View state
  viewMode: 'table' | 'kanban';
  showArchived: boolean;
  loading: boolean;

  // Actions
  setViewMode: (mode: 'table' | 'kanban') => void;
  setShowArchived: (show: boolean) => void;

  // CRUD operations
  fetchPurchases: () => Promise<void>;
  fetchReturns: () => Promise<void>;
  fetchTransfers: () => Promise<void>;

  createPurchase: (purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'estimatedDelivery' | 'isArchived' | 'workspace_id'>,
                   products: Omit<PurchaseProduct, 'id' | 'purchaseId' | 'totalCost' | 'isVerified' | 'isInStock' | 'vencimento'>[]) => Promise<void>;
  updatePurchase: (id: string, updates: Partial<Purchase>) => Promise<void>;
  archivePurchase: (id: string) => Promise<void>;
  verifyPurchaseProduct: (purchaseId: string, productId: string, vencimento?: string) => Promise<void>;
  addProductToInventory: (purchaseId: string) => Promise<void>;
  updateProductStatusToInStock: (purchaseId: string, productId: string) => Promise<void>;

  createReturn: (returnData: Omit<Return, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'estimatedDelivery' | 'isArchived' | 'workspace_id'>) => Promise<void>;
  updateReturn: (id: string, updates: Partial<Return>) => Promise<void>;
  archiveReturn: (id: string) => Promise<void>;

  createTransfer: (transfer: Omit<Transfer, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'estimatedDelivery' | 'isArchived' | 'workspace_id'>) => Promise<void>;
  updateTransfer: (id: string, updates: Partial<Transfer>) => Promise<void>;
  archiveTransfer: (id: string) => Promise<void>;

  // Tracking operations
  updateTrackingStatus: (type: 'purchase' | 'return' | 'transfer', id: string) => Promise<void>;
  updateAllTrackingStatuses: () => Promise<void>;
  getTrackingInfo: (carrier: string, trackingCode: string) => Promise<TrackingResponse>;
  findItemByTrackingCode: (trackingCode: string) => Promise<{type: 'purchase' | 'return' | 'transfer', item: Purchase | Return | Transfer} | null>;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  purchases: [],
  returns: [],
  transfers: [],
  viewMode: 'table',
  showArchived: false,
  loading: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setShowArchived: (show) => {
    set({ showArchived: show });
    const { fetchPurchases, fetchReturns, fetchTransfers } = get();
    fetchPurchases();
    fetchReturns();
    fetchTransfers();
  },
  fetchPurchases: async () => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });

      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      let query = supabase
        .from('purchases')
        // Ao usar *, o Supabase geralmente retorna os nomes de coluna como estão no DB.
        // Se as colunas já estão em camelCase no DB, o mapeamento manual abaixo
        // não seria estritamente necessário para 'isVerified', 'isInStock', 'vencimento'
        // mas o mantive para garantir robustez caso haja alguma inconsistência.
        .select(`
          *,
          products:purchase_products(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('date', { ascending: false });

      if (!get().showArchived) {
        query = query.eq('isArchived', false); // Usando 'isArchived' em camelCase para o filtro
      }

      const { data, error } = await query;

      if (error) throw error;

      // Mapeamento explícito para garantir que as propriedades camelCase
      // estejam presentes mesmo que o Supabase retorne snake_case padrão para aliases.
      // Se seu DB já está 100% camelCase, este mapeamento serve como redundância segura.
      const formattedData: Purchase[] = (data || []).map((purchase: any) => ({
        ...purchase,
        isArchived: purchase.isArchived, // Garante que isArchived seja mapeado corretamente
        products: (purchase.products || []).map((product: any) => ({
          ...product,
          isVerified: product.isVerified, // Confirma mapeamento (se vier como is_verified)
          isInStock: product.isInStock,   // Confirma mapeamento (se vier como is_in_stock)
          vencimento: product.vencimento, // Confirma mapeamento
          sku: product.sku // Confirma mapeamento
        }))
      }));


      set({ purchases: formattedData || [], loading: false });
    });
  },

  fetchReturns: async () => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });

      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      let query = supabase
        .from('returns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('date', { ascending: false });

      if (!get().showArchived) {
        query = query.eq('isArchived', false); // Usando 'isArchived' em camelCase para o filtro
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ returns: data || [], loading: false });
    });
  },

  fetchTransfers: async () => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });

      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      let query = supabase
        .from('transfers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('date', { ascending: false });

      if (!get().showArchived) {
        query = query.eq('isArchived', false); // Usando 'isArchived' em camelCase para o filtro
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ transfers: data || [], loading: false });
    });
  },

  createPurchase: async (purchaseData, products) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      // Usando camelCase para os nomes das colunas, como no seu DB
      const dbPurchaseData = {
        date: purchaseData.date,
        carrier: purchaseData.carrier,
        storeName: purchaseData.storeName, // Usando camelCase
        customerName: purchaseData.customerName || null, // Usando camelCase
        trackingCode: purchaseData.trackingCode, // Usando camelCase
        deliveryFee: purchaseData.deliveryFee, // Usando camelCase
        status: 'Aguardando rastreamento',
        isArchived: false, // Usando camelCase
        workspace_id: currentWorkspace.id
      };

      console.log("Creating purchase with data:", dbPurchaseData);

      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert(dbPurchaseData)
        .select()
        .single();

      if (purchaseError) {
        console.error("Error creating purchase:", purchaseError);
        throw purchaseError;
      }

      console.log("Purchase created:", purchase);

      // Usando camelCase para os nomes das colunas de produto
      const productsWithPurchaseId = products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        cost: product.cost,
        sku: product.sku, // Usando camelCase
        purchaseId: purchase.id, // Usando camelCase
        isVerified: false, // Usando camelCase
        isInStock: false, // Usando camelCase
        vencimento: product.vencimento || null, // Usando camelCase
      }));

      console.log("Creating products:", productsWithPurchaseId);

      const { error: productsError } = await supabase
        .from('purchase_products')
        .insert(productsWithPurchaseId);

      if (productsError) {
        console.error("Error creating products:", productsError);
        throw productsError;
      }

      try {
        await get().updateTrackingStatus('purchase', purchase.id);
      } catch (error) {
        console.warn("Could not update tracking status for new purchase:", error);
      }

      get().fetchPurchases();

      ErrorHandler.showSuccess('Compra criada com sucesso!');
    });
  },

  updatePurchase: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      // Usando camelCase para os nomes das colunas
      const dbUpdates: any = {
        updatedAt: new Date().toISOString() // Usando camelCase
      };

      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customerName !== undefined) dbUpdates.customerName = updates.customerName;
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.deliveryFee !== undefined) dbUpdates.deliveryFee = updates.deliveryFee;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimatedDelivery = updates.estimatedDelivery;
      if (updates.isArchived !== undefined) dbUpdates.isArchived = updates.isArchived;

      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.status !== undefined) dbUpdates.status = updates.status;


      console.log("Updating purchase with data:", dbUpdates);

      const { error } = await supabase
        .from('purchases')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error("Error updating purchase:", error);
        throw error;
      }

      get().fetchPurchases();
      ErrorHandler.showSuccess('Compra atualizada com sucesso!');
    });
  },

  archivePurchase: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Archiving purchase:", id);

      const { error } = await supabase
        .from('purchases')
        .update({
          isArchived: true, // Usando camelCase
          updatedAt: new Date().toISOString() // Usando camelCase
        })
        .eq('id', id);

      if (error) {
        console.error("Error archiving purchase:", error);
        throw error;
      }

      get().fetchPurchases();
      ErrorHandler.showSuccess('Compra arquivada com sucesso!');
    });
  },

  verifyPurchaseProduct: async (purchaseId, productId, vencimento) => {
    await ErrorHandler.handleAsync(async () => {
      const updates: { isVerified: boolean; updatedAt: string; vencimento?: string | null } = { // Usando camelCase
        isVerified: true, // Usando camelCase
        updatedAt: new Date().toISOString() // Usando camelCase
      };
      if (vencimento !== undefined) {
        updates.vencimento = vencimento;
      }

      const { error } = await supabase
        .from('purchase_products')
        .update(updates)
        .eq('id', productId)
        .eq('purchaseId', purchaseId); // Usando camelCase

      if (error) {
        console.error("Erro ao verificar produto:", error);
        throw error;
      }

      set((state) => ({
        purchases: state.purchases.map((purchase) =>
          purchase.id === purchaseId
            ? {
                ...purchase,
                products: purchase.products?.map((p) =>
                  p.id === productId ? { ...p, isVerified: true, vencimento: vencimento || p.vencimento } : p
                ),
              }
            : purchase
        ),
      }));

      const { data: products, error: fetchProductsError } = await supabase
        .from('purchase_products')
        .select('isVerified') // Usando camelCase
        .eq('purchaseId', purchaseId); // Usando camelCase

      if (fetchProductsError) {
        console.error("Erro ao buscar produtos para verificação total:", fetchProductsError);
        throw fetchProductsError;
      }

      const allVerified = products?.every(product => product.isVerified); // Usando camelCase

      if (allVerified) {
        await supabase
          .from('purchases')
          .update({
            status: 'Produto entregue e conferido',
            updatedAt: new Date().toISOString() // Usando camelCase
          })
          .eq('id', purchaseId);
      }

      get().fetchPurchases();
    });
  },

  updateProductStatusToInStock: async (purchaseId, productId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('purchase_products')
        .update({
          isInStock: true, // Usando camelCase
          updatedAt: new Date().toISOString() // Usando camelCase
        })
        .eq('id', productId)
        .eq('purchaseId', purchaseId); // Usando camelCase

      if (error) {
        console.error("Erro ao adicionar produto ao estoque:", error);
        throw error;
      }

      set((state) => ({
        purchases: state.purchases.map((purchase) =>
          purchase.id === purchaseId
            ? {
                ...purchase,
                products: purchase.products?.map((p) =>
                  p.id === productId ? { ...p, isInStock: true } : p
                ),
              }
            : purchase
        ),
      }));

      const { data: products, error: fetchProductsError } = await supabase
        .from('purchase_products')
        .select('isInStock') // Usando camelCase
        .eq('purchaseId', purchaseId); // Usando camelCase

      if (fetchProductsError) {
        console.error("Erro ao buscar produtos para verificação de estoque total:", fetchProductsError);
        throw fetchProductsError;
      }

      const allInStock = products?.every(product => product.isInStock); // Usando camelCase

      if (allInStock) {
        await supabase
          .from('purchases')
          .update({
            status: 'Adicionado ao estoque',
            isArchived: true, // Usando camelCase
            updatedAt: new Date().toISOString() // Usando camelCase
          })
          .eq('id', purchaseId);
      }

      get().fetchPurchases();
    });
  },

  addProductToInventory: async (purchaseId) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Adicionando compra ao estoque:", purchaseId);

      const { error: productsUpdateError } = await supabase
        .from('purchase_products')
        .update({
          isInStock: true, // Usando camelCase
          updatedAt: new Date().toISOString() // Usando camelCase
        })
        .eq('purchaseId', purchaseId); // Usando camelCase

      if (productsUpdateError) {
        console.error("Erro ao atualizar produtos para 'em estoque':", productsUpdateError);
        throw productsUpdateError;
      }

      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          isArchived: true, // Usando camelCase
          status: 'Adicionado ao estoque',
          updatedAt: new Date().toISOString() // Usando camelCase
        })
        .eq('id', purchaseId);

      if (purchaseUpdateError) {
        console.error("Erro ao adicionar compra ao estoque:", purchaseUpdateError);
        throw purchaseUpdateError;
      }

      get().fetchPurchases();
      ErrorHandler.showSuccess('Compra e produtos adicionados ao estoque!');
    });
  },

  createReturn: async (returnData) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const dbReturnData = {
        date: returnData.date,
        carrier: returnData.carrier,
        storeName: returnData.storeName, // Usando camelCase
        customerName: returnData.customerName, // Usando camelCase
        trackingCode: returnData.trackingCode, // Usando camelCase
        status: 'Aguardando rastreamento',
        isArchived: false, // Usando camelCase
        workspace_id: currentWorkspace.id
      };

      console.log("Creating return with data:", dbReturnData);

      const { data: newReturn, error } = await supabase
        .from('returns')
        .insert(dbReturnData)
        .select()
        .single();

      if (error) {
        console.error("Error creating return:", error);
        throw error;
      }

      try {
        if (newReturn) {
          await get().updateTrackingStatus('return', newReturn.id);
        }
      } catch (error) {
        console.warn("Could not update tracking status for new return:", error);
      }

      get().fetchReturns();
      ErrorHandler.showSuccess('Devolução criada com sucesso!');
    });
  },

  updateReturn: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      const dbUpdates: any = {
        updatedAt: new Date().toISOString() // Usando camelCase
      };

      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customerName !== undefined) dbUpdates.customerName = updates.customerName;
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimatedDelivery = updates.estimatedDelivery;
      if (updates.isArchived !== undefined) dbUpdates.isArchived = updates.isArchived;

      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await supabase
        .from('returns')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      get().fetchReturns();
      ErrorHandler.showSuccess('Devolução atualizada com sucesso!');
    });
  },

  archiveReturn: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Archiving return:", id);

      const { error } = await supabase
        .from('returns')
        .update({
          isArchived: true, // Usando camelCase
          updatedAt: new Date().toISOString() // Usando camelCase
        })
        .eq('id', id);

      if (error) {
        console.error("Error archiving return:", error);
        throw error;
      }

      get().fetchReturns();
      ErrorHandler.showSuccess('Devolução arquivada com sucesso!');
    });
  },

  createTransfer: async (transferData) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const dbTransferData = {
        date: transferData.date,
        carrier: transferData.carrier,
        storeName: transferData.storeName, // Usando camelCase
        customerName: transferData.customerName, // Usando camelCase
        trackingCode: transferData.trackingCode, // Usando camelCase
        status: 'Aguardando rastreamento',
        isArchived: false, // Usando camelCase
        workspace_id: currentWorkspace.id
      };

      console.log("Creating transfer with data:", dbTransferData);

      const { data: newTransfer, error } = await supabase
        .from('transfers')
        .insert(dbTransferData)
        .select()
        .single();

      if (error) {
        console.error("Error creating transfer:", error);
        throw error;
      }

      try {
        if (newTransfer) {
          await get().updateTrackingStatus('transfer', newTransfer.id);
        }
      } catch (error) {
        console.warn("Could not update tracking status for new transfer:", error);
      }

      get().fetchTransfers();
      ErrorHandler.showSuccess('Transferência criada com sucesso!');
    });
  },

  updateTransfer: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      const dbUpdates: any = {
        updatedAt: new Date().toISOString() // Usando camelCase
      };

      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customerName !== undefined) dbUpdates.customerName = updates.customerName;
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimatedDelivery = updates.estimatedDelivery;
      if (updates.isArchived !== undefined) dbUpdates.isArchived = updates.isArchived;

      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await supabase
        .from('transfers')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      get().fetchTransfers();
      ErrorHandler.showSuccess('Transferência atualizada com sucesso!');
    });
  },

  archiveTransfer: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Archiving transfer:", id);

      const { error } = await supabase
        .from('transfers')
        .update({
          isArchived: true, // Usando camelCase
          updatedAt: new Date().toISOString() // Usando camelCase
        })
        .eq('id', id);

      if (error) {
        console.error("Error archiving transfer:", error);
        throw error;
      }

      get().fetchTransfers();
      ErrorHandler.showSuccess('Transferência arquivada com sucesso!');
    });
  },

  updateTrackingStatus: async (type, id) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: item } = await supabase
        .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
        .select('trackingCode, carrier') // Usando camelCase
        .eq('id', id)
        .single();

      if (!item) {
        console.error(`Item not found: ${type} ${id}`);
        return;
      }

      if (!item.trackingCode) { // Usando camelCase
        console.error(`No tracking code for ${type} ${id}`);
        return;
      }

      console.log(`Updating tracking for ${type} ${id}:`, item);

      try {
        const trackingInfo = await get().getTrackingInfo(item.carrier, item.trackingCode); // Usando camelCase

        if (!trackingInfo.success || !trackingInfo.data) {
          console.warn(`Failed to update tracking for ${type} ${id}:`, trackingInfo.error);
          return;
        }

        console.log(`Got tracking info for ${type} ${id}:`, trackingInfo);

        await supabase
          .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
          .update({
            status: trackingInfo.data.status,
            estimatedDelivery: trackingInfo.data.estimatedDelivery, // Usando camelCase
            updatedAt: new Date().toISOString() // Usando camelCase
          })
          .eq('id', id);

        if (type === 'purchase') get().fetchPurchases();
        else if (type === 'return') get().fetchReturns();
        else if (type === 'transfer') get().fetchTransfers();

        ErrorHandler.showSuccess('Status de rastreamento atualizado com sucesso!');
      } catch (error) {
        console.error(`Error updating ${item.carrier} tracking for ${type} ${id}:`, error);
        throw error;
      }
    });
  },

  updateAllTrackingStatuses: async () => {
    await ErrorHandler.handleAsync(async () => {
      const purchases = get().purchases.filter(p => !p.isArchived);
      const returns = get().returns.filter(r => !r.isArchived);
      const transfers = get().transfers.filter(t => !t.isArchived);

      let successCount = 0;
      let failureCount = 0;

      for (const purchase of purchases) {
        try {
          await get().updateTrackingStatus('purchase', purchase.id);
          successCount++;
        } catch (error) {
          failureCount++;
          console.warn(`Failed to update tracking for purchase ${purchase.id}:`, error);
        }
      }

      for (const returnItem of returns) {
        try {
          await get().updateTrackingStatus('return', returnItem.id);
          successCount++;
        } catch (error) {
          failureCount++;
          console.warn(`Failed to update tracking for return ${returnItem.id}:`, error);
        }
      }

      for (const transfer of transfers) {
        try {
          await get().updateTrackingStatus('transfer', transfer.id);
          successCount++;
        } catch (error) {
          failureCount++;
          console.warn(`Failed to update tracking for transfer ${transfer.id}:`, error);
        }
      }

      if (successCount > 0) {
        ErrorHandler.showSuccess(`${successCount} rastreamentos atualizados com sucesso!`);
      }

      if (failureCount > 0) {
        ErrorHandler.showError(`${failureCount} rastreamentos falharam. Verifique a conexão com a internet.`);
      }
    });
  },

  getTrackingInfo: async (carrier: string, trackingCode: string) => {
    try {
      if (!carrier || !trackingCode) {
        return {
          success: false,
          error: 'Transportadora ou código de rastreio não informados'
        };
      }

      console.log(`Getting tracking info for ${carrier} ${trackingCode}`);

      const trackingData = await trackPackage(carrier, trackingCode);

      console.log(`Tracking data for ${trackingCode}:`, trackingData);

      if (trackingData.success) {
        const parsedData = parseTrackingResponse(carrier, trackingData);
        return {
          success: true,
          data: parsedData
        };
      } else {
        return {
          success: false,
          error: trackingData.message || 'Falha ao rastrear objeto'
        };
      }
    } catch (error) {
      console.error('Error tracking package:', error);
      return {
        success: false,
        error: error.message || 'Falha ao rastrear objeto'
      };
    }
  },

  findItemByTrackingCode: async (trackingCode: string) => {
    return await ErrorHandler.handleAsync(async () => {
      if (!trackingCode) return null;

      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return null;

      const { data: purchaseData } = await supabase
        .from('purchases')
        .select(`
          *,
          products:purchase_products(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('trackingCode', trackingCode) // Usando camelCase
        .maybeSingle();

      if (purchaseData) {
        const formattedPurchaseData = {
          ...purchaseData,
          products: (purchaseData.products || []).map((product: any) => ({
            ...product,
            isVerified: product.isVerified,
            isInStock: product.isInStock,
            vencimento: product.vencimento,
            sku: product.sku // Mapeia SKU
          }))
        };
        return { type: 'purchase' as const, item: formattedPurchaseData };
      }

      const { data: returnData } = await supabase
        .from('returns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('trackingCode', trackingCode) // Usando camelCase
        .maybeSingle();

      if (returnData) {
        return { type: 'return' as const, item: returnData };
      }

      const { data: transferData } = await supabase
        .from('transfers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('trackingCode', trackingCode) // Usando camelCase
        .maybeSingle();

      if (transferData) {
        return { type: 'transfer' as const, item: transferData };
      }

      return null;
    }) || null;
  }
}));