import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';
import { Purchase, PurchaseProduct, Return, Transfer, TrackingResponse } from '@/types/tracking';
import { trackPackage, parseTrackingResponse, getTrackingUrl } from '@/lib/tracking-api';

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
                   products: Omit<PurchaseProduct, 'id' | 'purchaseId' | 'totalCost' | 'isVerified'>[]) => Promise<void>;
  updatePurchase: (id: string, updates: Partial<Purchase>) => Promise<void>;
  archivePurchase: (id: string) => Promise<void>;
  verifyPurchaseProduct: (purchaseId: string, productId: string) => Promise<void>;
  addProductToInventory: (purchaseId: string) => Promise<void>;
  
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
    // Refresh data when toggling archived items
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
      
      // Query to get purchases with their products
      let query = supabase
        .from('purchases')
        .select(`
          *,
          products:purchase_products(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('date', { ascending: false });
      
      // Filter by archived status if not showing archived
      if (!get().showArchived) {
        query = query.eq('is_archived', false);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      set({ purchases: data || [], loading: false });
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
      
      // Filter by archived status if not showing archived
      if (!get().showArchived) {
        query = query.eq('is_archived', false);
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
      
      // Filter by archived status if not showing archived
      if (!get().showArchived) {
        query = query.eq('is_archived', false);
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
      
      // Convert camelCase to snake_case for database fields
      const dbPurchaseData = {
        date: purchaseData.date,
        carrier: purchaseData.carrier,
        storeName: purchaseData.storeName,
        customer_name: purchaseData.customerName || null,
        tracking_code: purchaseData.trackingCode,
        delivery_fee: purchaseData.deliveryFee,
        status: 'Aguardando rastreamento',
        is_archived: false,
        workspace_id: currentWorkspace.id
      };
      
      console.log("Creating purchase with data:", dbPurchaseData);
      
      // Create purchase record
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
      
      // Create product records - remove total_cost as it's a generated column
      const productsWithPurchaseId = products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        cost: product.cost,
        purchase_id: purchase.id,
        is_verified: false
        // total_cost is removed as it's automatically calculated by the database
      }));
      
      console.log("Creating products:", productsWithPurchaseId);
      
      const { error: productsError } = await supabase
        .from('purchase_products')
        .insert(productsWithPurchaseId);
      
      if (productsError) {
        console.error("Error creating products:", productsError);
        throw productsError;
      }
      
      // Try to update tracking status, but don't fail if it doesn't work
      try {
        await get().updateTrackingStatus('purchase', purchase.id);
      } catch (error) {
        console.warn("Could not update tracking status for new purchase:", error);
        // Don't throw the error, just log it
      }
      
      // Refresh data
      get().fetchPurchases();
      
      ErrorHandler.showSuccess('Compra criada com sucesso!');
    });
  },
  
  updatePurchase: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      // Convert camelCase to snake_case for database fields
      const dbUpdates: any = {};
      
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customerName !== undefined) dbUpdates.customer_name = updates.customerName;
      if (updates.trackingCode !== undefined) dbUpdates.tracking_code = updates.trackingCode;
      if (updates.deliveryFee !== undefined) dbUpdates.delivery_fee = updates.deliveryFee;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimated_delivery = updates.estimatedDelivery;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
      
      // Copy other fields that don't need conversion
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      
      dbUpdates.updated_at = new Date().toISOString();
      
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
  
  verifyPurchaseProduct: async (purchaseId, productId) => {
    await ErrorHandler.handleAsync(async () => {
      // Update the product as verified
      const { error } = await supabase
        .from('purchase_products')
        .update({
          is_verified: true
        })
        .eq('id', productId)
        .eq('purchase_id', purchaseId);
      
      if (error) {
        console.error("Error verifying product:", error);
        throw error;
      }
      
      // Check if all products are verified
      const { data: products } = await supabase
        .from('purchase_products')
        .select('is_verified')
        .eq('purchase_id', purchaseId);
      
      const allVerified = products?.every(product => product.is_verified);
      
      if (allVerified) {
        // Update purchase status
        await supabase
          .from('purchases')
          .update({
            status: 'Produto entregue e conferido',
            updated_at: new Date().toISOString()
          })
          .eq('id', purchaseId);
      }
      
      get().fetchPurchases();
      ErrorHandler.showSuccess('Produto verificado com sucesso!');
    });
  },
  
  addProductToInventory: async (purchaseId) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Adding purchase to inventory:", purchaseId);
      
      // Get purchase products
      const { data: products } = await supabase
        .from('purchase_products')
        .select('*')
        .eq('purchase_id', purchaseId);
      
      if (!products || products.length === 0) return;
      
      // Add products to inventory (this would connect to your inventory system)
      // For now, we'll just mark the purchase as archived and update status
      await supabase
        .from('purchases')
        .update({
          is_archived: true,
          status: 'Adicionado ao estoque',
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseId);
      
      get().fetchPurchases();
      ErrorHandler.showSuccess('Produtos adicionados ao estoque!');
    });
  },
  
  createReturn: async (returnData) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
      
      // Convert camelCase to snake_case for database fields
      const dbReturnData = {
        date: returnData.date,
        carrier: returnData.carrier,
        storeName: returnData.storeName,
        customer_name: returnData.customerName,
        tracking_code: returnData.trackingCode,
        status: 'Aguardando rastreamento',
        is_archived: false,
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
      
      // Try to update tracking status, but don't fail if it doesn't work
      try {
        if (newReturn) {
          await get().updateTrackingStatus('return', newReturn.id);
        }
      } catch (error) {
        console.warn("Could not update tracking status for new return:", error);
        // Don't throw the error, just log it
      }
      
      get().fetchReturns();
      ErrorHandler.showSuccess('Devolução criada com sucesso!');
    });
  },
  
  updateReturn: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      // Convert camelCase to snake_case for database fields
      const dbUpdates: any = {};
      
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customerName !== undefined) dbUpdates.customer_name = updates.customerName;
      if (updates.trackingCode !== undefined) dbUpdates.tracking_code = updates.trackingCode;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimated_delivery = updates.estimatedDelivery;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
      
      // Copy other fields that don't need conversion
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      
      dbUpdates.updated_at = new Date().toISOString();
      
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
  
  createTransfer: async (transferData) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
      
      // Convert camelCase to snake_case for database fields
      const dbTransferData = {
        date: transferData.date,
        carrier: transferData.carrier,
        storeName: transferData.storeName,
        customer_name: transferData.customerName,
        tracking_code: transferData.trackingCode,
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
      
      // Try to update tracking status, but don't fail if it doesn't work
      try {
        if (newTransfer) {
          await get().updateTrackingStatus('transfer', newTransfer.id);
        }
      } catch (error) {
        console.warn("Could not update tracking status for new transfer:", error);
        // Don't throw the error, just log it
      }
      
      get().fetchTransfers();
      ErrorHandler.showSuccess('Transferência criada com sucesso!');
    });
  },
  
  updateTransfer: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      // Convert camelCase to snake_case for database fields
      const dbUpdates: any = {};
      
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customerName !== undefined) dbUpdates.customer_name = updates.customerName;
      if (updates.trackingCode !== undefined) dbUpdates.tracking_code = updates.trackingCode;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimated_delivery = updates.estimatedDelivery;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
      
      // Copy other fields that don't need conversion
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      
      dbUpdates.updated_at = new Date().toISOString();
      
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
      // Get the item
      const { data: item } = await supabase
        .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
        .select('tracking_code, carrier')
        .eq('id', id)
        .single();
      
      if (!item) {
        console.error(`Item not found: ${type} ${id}`);
        return;
      }
      
      if (!item.tracking_code) {
        console.error(`No tracking code for ${type} ${id}`);
        return;
      }
      
      console.log(`Updating tracking for ${type} ${id}:`, item);
      
      try {
        // Get tracking info using our tracking API
        const trackingInfo = await get().getTrackingInfo(item.carrier, item.tracking_code);
        
        if (!trackingInfo.success || !trackingInfo.data) {
          console.warn(`Failed to update tracking for ${type} ${id}:`, trackingInfo.error);
          return;
        }
        
        console.log(`Got tracking info for ${type} ${id}:`, trackingInfo);
        
        // Update status
        await supabase
          .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
          .update({
            status: trackingInfo.data.status,
            estimated_delivery: trackingInfo.data.estimatedDelivery,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        // Refresh data
        if (type === 'purchase') get().fetchPurchases();
        else if (type === 'return') get().fetchReturns();
        else get().fetchTransfers();
        
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
      
      // Update purchases
      for (const purchase of purchases) {
        try {
          await get().updateTrackingStatus('purchase', purchase.id);
          successCount++;
        } catch (error) {
          failureCount++;
          console.warn(`Failed to update tracking for purchase ${purchase.id}:`, error);
        }
      }
      
      // Update returns
      for (const returnItem of returns) {
        try {
          await get().updateTrackingStatus('return', returnItem.id);
          successCount++;
        } catch (error) {
          failureCount++;
          console.warn(`Failed to update tracking for return ${returnItem.id}:`, error);
        }
      }
      
      // Update transfers
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
      
      // Use our tracking API
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
      
      // Search in purchases
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select(`
          *,
          products:purchase_products(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('tracking_code', trackingCode)
        .maybeSingle();
      
      if (purchaseData) {
        return { type: 'purchase' as const, item: purchaseData };
      }
      
      // Search in returns
      const { data: returnData } = await supabase
        .from('returns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('tracking_code', trackingCode)
        .maybeSingle();
      
      if (returnData) {
        return { type: 'return' as const, item: returnData };
      }
      
      // Search in transfers
      const { data: transferData } = await supabase
        .from('transfers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('tracking_code', trackingCode)
        .maybeSingle();
      
      if (transferData) {
        return { type: 'transfer' as const, item: transferData };
      }
      
      return null;
    }) || null;
  }
}));