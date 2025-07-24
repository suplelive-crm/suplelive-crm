import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';
import { Purchase, PurchaseProduct, Return, Transfer, TrackingResponse } from '@/types/tracking';
import { trackPackage, parseTrackingResponse, getTrackingUrl, runTrackingAutomation } from '@/lib/tracking-api';

// Tipos para os dados do formulário, para clareza
interface PurchaseFormData {
  date: string;
  carrier: string;
  storeName: string;
  customer_name?: string;
  trackingCode: string;
  delivery_fee: number;
}

// Omit<> remove campos do tipo original para criar um novo tipo
// Adicionamos 'id' como opcional, pois um produto vindo do formulário pode ser antigo (com id) ou novo (sem id)
type FormProduct = Partial<Omit<PurchaseProduct, 'purchase_id' | 'is_verified' | 'is_in_stock' | 'total_cost' | 'created_at' | 'updated_at'>>;


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

  createPurchase: (purchaseData: PurchaseFormData, products: FormProduct[]) => Promise<void>;
  updatePurchase: (purchaseId: string, formData: PurchaseFormData, products: FormProduct[]) => Promise<void>;
  archivePurchase: (id: string) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;

  verifyPurchaseProduct: (purchaseId: string, productId: string, vencimento?: string) => Promise<void>;
  addProductToInventory: (purchaseId: string) => Promise<void>;
  updateProductStatusToInStock: (purchaseId: string, productId: string) => Promise<void>;

  createReturn: (returnData: {
    date: string;
    carrier: string;
    storeName: string;
    customerName: string;
    trackingCode: string;
    observations?: string;
  }) => Promise<void>;
  updateReturn: (id: string, updates: Partial<{
    date: string;
    carrier: string;
    storeName: string;
    customerName: string;
    trackingCode: string;
    status: string;
    estimatedDelivery?: string;
    isArchived: boolean;
    observations?: string;
    is_verified: boolean;
    verification_observations?: string;
  }>) => Promise<void>;
  archiveReturn: (id: string) => Promise<void>;
  verifyReturn: (id: string, verification_observations?: string) => Promise<void>;

  createTransfer: (transfer: {
    date: string;
    carrier: string;
    storeName: string;
    customerName: string;
    trackingCode: string;
  }) => Promise<void>;
  updateTransfer: (id: string, updates: Partial<{
    date: string;
    carrier: string;
    storeName: string;
    customerName: string;
    trackingCode: string;
    status: string;
    estimatedDelivery?: string;
    isArchived: boolean;
  }>) => Promise<void>;
  archiveTransfer: (id: string) => Promise<void>;

  // Tracking operations
  updateTrackingStatus: (type: 'purchase' | 'return' | 'transfer', id: string) => Promise<void>;
  updateAllTrackingStatuses: () => Promise<void>;
  getTrackingInfo: (carrier: string, trackingCode: string) => Promise<TrackingResponse>;
  findItemByTrackingCode: (trackingCode: string) => Promise<{ type: 'purchase' | 'return' | 'transfer', item: Purchase | Return | Transfer } | null>;
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
        .select(`
          *,
          products:purchase_products(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('date', { ascending: false });

      if (!get().showArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData: Purchase[] = (data || []).map((purchase: any) => ({
        id: purchase.id,
        date: purchase.date,
        carrier: purchase.carrier,
        storeName: purchase.storeName,
        customer_name: purchase.customer_name,
        trackingCode: purchase.trackingCode,
        delivery_fee: purchase.delivery_fee,
        status: purchase.status,
        estimated_delivery: purchase.estimated_delivery,
        is_archived: purchase.is_archived,
        created_at: purchase.created_at,
        updated_at: purchase.updated_at,
        workspace_id: purchase.workspace_id,
        products: (purchase.products || []).map((product: any) => ({
          id: product.id,
          purchase_id: product.purchase_id,
          name: product.name,
          quantity: product.quantity,
          cost: product.cost,
          total_cost: product.total_cost,
          is_verified: product.is_verified,
          is_in_stock: product.is_in_stock,
          vencimento: product.vencimento,
          SKU: product.SKU,
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
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData: Return[] = (data || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        carrier: item.carrier,
        storeName: item.storeName,
        customer_name: item.customer_name,
        trackingCode: item.trackingCode,
        status: item.status,
        estimated_delivery: item.estimated_delivery,
        is_archived: item.is_archived,
        created_at: item.created_at,
        updated_at: item.updated_at,
        workspace_id: item.workspace_id,
        observations: item.observations,
        is_verified: item.is_verified,
        verification_observations: item.verification_observations,
        verified_at: item.verified_at,
      }));

      set({ returns: formattedData || [], loading: false });
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
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData: Transfer[] = (data || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        carrier: item.carrier,
        storeName: item.storeName,
        customer_name: item.customer_name,
        trackingCode: item.trackingCode,
        status: item.status,
        estimated_delivery: item.estimated_delivery,
        is_archived: item.is_archived,
        created_at: item.created_at,
        updated_at: item.updated_at,
        workspace_id: item.workspace_id,
        observations: item.observations,
        is_verified: item.is_verified,
        verification_observations: item.verification_observations,
        verified_at: item.verified_at,
      }));


      set({ transfers: formattedData || [], loading: false });
    });
  },

  createPurchase: async (purchaseData, products) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const dbPurchaseData = {
        date: purchaseData.date,
        carrier: purchaseData.carrier,
        storeName: purchaseData.storeName,
        customer_name: purchaseData.customer_name || null,
        trackingCode: purchaseData.trackingCode,
        delivery_fee: purchaseData.delivery_fee,
        status: 'Aguardando rastreamento',
        is_archived: false,
        workspace_id: currentWorkspace.id
      };

      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert(dbPurchaseData)
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const deliveryFeePerUnit = totalQuantity > 0 ? purchaseData.delivery_fee / totalQuantity : 0;

      const productsWithPurchaseId = products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        cost: parseFloat(((product.cost || 0) + deliveryFeePerUnit).toFixed(2)),
        SKU: product.sku,
        purchase_id: purchase.id,
        is_verified: false,
        is_in_stock: false,
        vencimento: product.vencimento || null,
      }));

      const { error: productsError } = await supabase
        .from('purchase_products')
        .insert(productsWithPurchaseId);

      if (productsError) throw productsError;

      try {
        await get().updateTrackingStatus('purchase', purchase.id);
      } catch (error) {
        console.warn("Could not update tracking status for new purchase:", error);
      }

      get().fetchPurchases();
      ErrorHandler.showSuccess('Compra criada com sucesso!');
    });
  },
  
  updatePurchase: async (purchaseId, formData, products) => {
    await ErrorHandler.handleAsync(async () => {
      const params = {
        p_id: purchaseId,
        p_date: formData.date,
        p_carrier: formData.carrier,
        p_store_name: formData.storeName,
        p_customer_name: formData.customer_name || null,
        p_tracking_code: formData.trackingCode,
        p_delivery_fee: formData.delivery_fee,
        p_products: products.map(p => ({
            name: p.name,
            sku: p.sku,
            quantity: p.quantity,
            cost: p.cost
        }))
      };

      const { error } = await supabase.rpc('update_purchase_and_products', params);

      if (error) {
        console.error("Erro ao atualizar a compra via RPC:", error);
        throw error;
      }

      await get().fetchPurchases();
    });
  },

  archivePurchase: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Archiving purchase:", id);

      const { error } = await supabase
        .from('purchases')
        .update({
          is_archived: true,
          updated_at: new Date().toISOString()
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

  deletePurchase: async (purchaseId: string) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase.rpc('delete_purchase_and_products', {
        p_id: purchaseId,
      });

      if (error) {
        console.error("Erro ao deletar o pedido de compra:", error);
        throw error;
      }

      set((state) => ({
        purchases: state.purchases.filter((p) => p.id !== purchaseId),
      }));
      
      ErrorHandler.showSuccess('Pedido de compra deletado com sucesso!');
    });
  },

  verifyPurchaseProduct: async (purchaseId, productId, vencimento) => {
    await ErrorHandler.handleAsync(async () => {
      const updates: { is_verified: boolean; updated_at: string; vencimento?: string | null } = {
        is_verified: true,
        updated_at: new Date().toISOString()
      };
      if (vencimento !== undefined) {
        updates.vencimento = vencimento;
      }

      const { error } = await supabase
        .from('purchase_products')
        .update(updates)
        .eq('id', productId)
        .eq('purchase_id', purchaseId);

      if (error) {
        console.error("Erro ao verificar produto:", error);
        throw error;
      }

      set((state) => ({
        purchases: state.purchases.map((purchase) =>
          purchase.id === purchaseId
            ? {
                ...purchase,
                products: (purchase.products || []).map((p) =>
                  p.id === productId ? { ...p, is_verified: true, vencimento: vencimento || p.vencimento } : p
                ),
              }
            : purchase
        ),
      }));

      const { data: products, error: fetchProductsError } = await supabase
        .from('purchase_products')
        .select('is_verified')
        .eq('purchase_id', purchaseId);

      if (fetchProductsError) {
        console.error("Erro ao buscar produtos para verificação total:", fetchProductsError);
        throw fetchProductsError;
      }

      const allVerified = (products || []).every(product => product.is_verified);

      if (allVerified) {
        await supabase
          .from('purchases')
          .update({
            status: 'Produto entregue e conferido',
            updated_at: new Date().toISOString()
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
          is_in_stock: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .eq('purchase_id', purchaseId);

      if (error) {
        console.error("Erro ao adicionar produto ao estoque:", error);
        throw error;
      }

      set((state) => ({
        purchases: state.purchases.map((purchase) =>
          purchase.id === purchaseId
            ? {
                ...purchase,
                products: (purchase.products || []).map((p) =>
                  p.id === productId ? { ...p, is_in_stock: true } : p
                ),
              }
            : purchase
        ),
      }));

      const { data: products, error: fetchProductsError } = await supabase
        .from('purchase_products')
        .select('is_in_stock')
        .eq('purchase_id', purchaseId);

      if (fetchProductsError) {
        console.error("Erro ao buscar produtos para verificação de estoque total:", fetchProductsError);
        throw fetchProductsError;
      }

      const allInStock = (products || []).every(product => product.is_in_stock);

      if (allInStock) {
        await supabase
          .from('purchases')
          .update({
            status: 'Adicionado ao estoque',
            is_archived: true,
            updated_at: new Date().toISOString()
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
          is_in_stock: true,
          updated_at: new Date().toISOString()
        })
        .eq('purchase_id', purchaseId);

      if (productsUpdateError) {
        console.error("Erro ao atualizar produtos para 'em estoque':", productsUpdateError);
        throw productsUpdateError;
      }

      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          is_archived: true,
          status: 'Adicionado ao estoque',
          updated_at: new Date().toISOString()
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
        storeName: returnData.storeName,
        customer_name: returnData.customer_name,
        trackingCode: returnData.trackingCode,
        status: 'Aguardando rastreamento',
        is_archived: false,
        workspace_id: currentWorkspace.id,
        observations: returnData.observations || null,
        is_verified: false
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
        updated_at: new Date().toISOString()
      };

      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customer_name !== undefined) dbUpdates.customer_name = updates.customer_name;
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.estimated_delivery !== undefined) dbUpdates.estimated_delivery = updates.estimated_delivery;
      if (updates.is_archived !== undefined) dbUpdates.is_archived = updates.is_archived;
      if (updates.observations !== undefined) dbUpdates.observations = updates.observations;
      if (updates.is_verified !== undefined) dbUpdates.is_verified = updates.is_verified;
      if (updates.verification_observations !== undefined) dbUpdates.verification_observations = updates.verification_observations;

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
          is_archived: true,
          updated_at: new Date().toISOString()
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

  verifyReturn: async (id: string, verification_observations?: string) => {
    await ErrorHandler.handleAsync(async () => {
      // Objeto que será enviado para o banco de dados
      const updateData: {
        is_verified: boolean;
        verified_at: string;
        updated_at: string;
        verification_observations?: string;
      } = {
        is_verified: true, // Marca como verificado
        verified_at: new Date().toISOString(), // Salva a data da verificação
        updated_at: new Date().toISOString(), // Atualiza o timestamp
      };

      // Adiciona as observações ao objeto APENAS se elas existirem
      if (verification_observations && verification_observations.trim() !== '') {
        updateData.verification_observations = verification_observations;
      }

      const { error } = await supabase
        .from('returns')
        .update(updateData) // Envia o objeto completo para o Supabase
        .eq('id', id);

      if (error) {
        console.error("Erro ao verificar devolução:", error);
        throw error;
      }

      // Atualiza a lista de devoluções na tela
      get().fetchReturns(); 
      ErrorHandler.showSuccess('Devolução conferida com sucesso!');
    });
  },

  createTransfer: async (transferData) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const dbTransferData = {
        date: transferData.date,
        carrier: transferData.carrier,
        storeName: transferData.storeName,
        customer_name: transferData.customer_name,
        trackingCode: transferData.trackingCode,
        status: 'Aguardando rastreamento',
        is_archived: false,
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
        updated_at: new Date().toISOString()
      };

      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customer_name !== undefined) dbUpdates.customer_name = updates.customer_name;
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.estimated_delivery !== undefined) dbUpdates.estimated_delivery = updates.estimated_delivery;
      if (updates.is_archived !== undefined) dbUpdates.is_archived = updates.is_archived;

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
          is_archived: true,
          updated_at: new Date().toISOString()
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
        .select('trackingCode, carrier')
        .eq('id', id)
        .single();

      if (!item) {
        console.error(`Item not found: ${type} ${id}`);
        return;
      }

      if (!item.trackingCode) {
        console.error(`No tracking code for ${type} ${id}`);
        return;
      }

      console.log(`Updating tracking for ${type} ${id}:`, item);

      try {
        const trackingInfo = await get().getTrackingInfo(item.carrier, item.trackingCode);

        if (!trackingInfo.success || !trackingInfo.data) {
          throw new Error(trackingInfo.error || 'Falha ao rastrear objeto');
        }

        console.log(`Got tracking info for ${type} ${id}:`, trackingInfo);

        await supabase
          .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
          .update({
            status: trackingInfo.data.status,
            estimated_delivery: trackingInfo.data.estimatedDelivery,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (type === 'purchase') get().fetchPurchases();
        else if (type === 'return') get().fetchReturns();
        else if (type === 'transfer') get().fetchTransfers();

        ErrorHandler.showSuccess('Status de rastreamento atualizado com sucesso!');
      } catch (error: any) {
        console.error(`Error updating ${item.carrier} tracking for ${type} ${id}:`, error);
        throw error;
      }
    });
  },

  updateAllTrackingStatuses: async () => {
    await ErrorHandler.handleAsync(async () => {
      try {
        const result = await runTrackingAutomation();
        
        if (result.success) {
          await Promise.all([
            get().fetchPurchases(),
            get().fetchReturns(),
            get().fetchTransfers()
          ]);
          
          ErrorHandler.showSuccess(
            `Automação de rastreamento concluída!`,
            `${result.updated} itens atualizados de ${result.total} processados`
          );
        } else {
          throw new Error(result.error || 'Falha na automação de rastreamento');
        }
      } catch (error: any) {
        console.error('Error in tracking automation:', error);
        ErrorHandler.showError(
          ErrorHandler.createError(
            'Erro na Automação',
            `Falha ao executar automação de rastreamento: ${error.message}`
          )
        );
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
          error: (trackingData as any).message || 'Falha ao rastrear objeto'
        };
      }
    } catch (error: any) {
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
        .eq('trackingCode', trackingCode)
        .maybeSingle();

      if (purchaseData) {
        const mappedPurchaseData: Purchase = {
          id: purchaseData.id,
          date: purchaseData.date,
          carrier: purchaseData.carrier,
          storeName: purchaseData.storeName,
          customer_name: purchaseData.customer_name,
          trackingCode: purchaseData.trackingCode,
          delivery_fee: purchaseData.delivery_fee,
          status: purchaseData.status,
          estimated_delivery: purchaseData.estimated_delivery,
          is_archived: purchaseData.is_archived,
          created_at: purchaseData.created_at,
          updated_at: purchaseData.updated_at,
          workspace_id: purchaseData.workspace_id,
          products: (purchaseData.products || []).map((product: any) => ({
            id: product.id,
            purchase_id: product.purchase_id,
            name: product.name,
            quantity: product.quantity,
            cost: product.cost,
            total_cost: product.total_cost,
            is_verified: product.is_verified,
            is_in_stock: product.is_in_stock,
            vencimento: product.vencimento,
            SKU: product.SKU,
          }))
        };
        return { type: 'purchase' as const, item: mappedPurchaseData };
      }

      const { data: returnData } = await supabase
        .from('returns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('trackingCode', trackingCode)
        .maybeSingle();

      if (returnData) {
        const mappedReturnData: Return = {
          id: returnData.id,
          date: returnData.date,
          carrier: returnData.carrier,
          storeName: returnData.storeName,
          customer_name: returnData.customer_name,
          trackingCode: returnData.trackingCode,
          status: returnData.status,
          estimated_delivery: returnData.estimated_delivery,
          is_archived: returnData.is_archived,
          created_at: returnData.created_at,
          updated_at: returnData.updated_at,
          workspace_id: returnData.workspace_id,
        };
        return { type: 'return' as const, item: mappedReturnData };
      }

      const { data: transferData } = await supabase
        .from('transfers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('trackingCode', trackingCode)
        .maybeSingle();

      if (transferData) {
        const mappedTransferData: Transfer = {
          id: transferData.id,
          date: transferData.date,
          carrier: transferData.carrier,
          storeName: transferData.storeName,
          customer_name: transferData.customer_name,
          trackingCode: transferData.trackingCode,
          status: transferData.status,
          estimated_delivery: transferData.estimated_delivery,
          is_archived: transferData.is_archived,
          created_at: transferData.created_at,
          updated_at: transferData.updated_at,
          workspace_id: transferData.workspace_id,
        };
        return { type: 'transfer' as const, item: mappedTransferData };
      }

      return null;
    }) || null;
  }
}));
