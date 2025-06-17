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

  createPurchase: (purchase: {
    date: string;
    carrier: string;
    storeName: string;
    customerName?: string;
    trackingCode: string;
    deliveryFee: number;
  },
    products: {
      name: string;
      quantity: number;
      cost: number;
      sku: string;
      vencimento?: string;
    }[]) => Promise<void>;


  updatePurchase: (id: string, updates: Partial<{
    date: string;
    carrier: string;
    storeName: string;
    customerName?: string;
    trackingCode: string;
    deliveryFee: number;
    status: string;
    estimatedDelivery?: string;
    isArchived: boolean;
  }>) => Promise<void>;
  archivePurchase: (id: string) => Promise<void>;

  verifyPurchaseProduct: (purchaseId: string, productId: string, vencimento?: string) => Promise<void>;
  addProductToInventory: (purchaseId: string) => Promise<void>;
  updateProductStatusToInStock: (purchaseId: string, productId: string) => Promise<void>;

  createReturn: (returnData: {
    date: string;
    carrier: string;
    storeName: string;
    customerName: string;
    trackingCode: string;
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
  }>) => Promise<void>;
  archiveReturn: (id: string) => Promise<void>;

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
        query = query.eq('is_archived', false); // Nome da coluna conforme imagem do DB
      }

      const { data, error } = await query;

      if (error) throw error;

      // Mapeamento explícito de nomes de coluna do DB para o tipo TS do front-end
      const formattedData: Purchase[] = (data || []).map((purchase: any) => ({
        // Campos da tabela purchases (Mistura de camelCase e snake_case)
        id: purchase.id,
        date: purchase.date,
        carrier: purchase.carrier,
        storeName: purchase.storeName,
        customer_name: purchase.customer_name, // Snake_case no DB
        trackingCode: purchase.trackingCode,
        delivery_fee: purchase.delivery_fee,   // Snake_case no DB
        status: purchase.status,
        estimated_delivery: purchase.estimated_delivery, // Snake_case no DB
        is_archived: purchase.is_archived,     // Snake_case no DB
        created_at: purchase.created_at,       // Snake_case no DB
        updated_at: purchase.updated_at,       // Snake_case no DB
        workspace_id: purchase.workspace_id,   // Snake_case no DB
        // Produtos aninhados (mapeamento para o tipo PurchaseProduct)
        products: (purchase.products || []).map((product: any) => ({
          id: product.id,
          purchase_id: product.purchase_id,   // Snake_case no DB
          name: product.name,
          quantity: product.quantity,
          cost: product.cost,
          total_cost: product.total_cost,     // Snake_case no DB
          is_verified: product.is_verified,   // Snake_case no DB
          is_in_stock: product.is_in_stock,   // Snake_case no DB
          vencimento: product.vencimento,     // CamelCase no DB
          SKU: product.SKU,                   // UPPERCASE no DB
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
        query = query.eq('is_archived', false); // Nome da coluna conforme imagem do DB
      }

      const { data, error } = await query;

      if (error) throw error;

      // Mapeamento explícito para retorno (mesmo que só alguns campos sejam snake_case)
      const formattedData: Return[] = (data || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        carrier: item.carrier,
        storeName: item.storeName,
        customer_name: item.customer_name, // Snake_case no DB
        trackingCode: item.trackingCode,
        status: item.status,
        estimated_delivery: item.estimated_delivery, // Snake_case no DB
        is_archived: item.is_archived,       // Snake_case no DB
        created_at: item.created_at,         // Snake_case no DB
        updated_at: item.updated_at,         // Snake_case no DB
        workspace_id: item.workspace_id,     // Snake_case no DB
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
        query = query.eq('is_archived', false); // Nome da coluna conforme imagem do DB
      }

      const { data, error } = await query;

      if (error) throw error;

      // Mapeamento explícito para retorno
      const formattedData: Transfer[] = (data || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        carrier: item.carrier,
        storeName: item.storeName,
        customer_name: item.customer_name, // Snake_case no DB
        trackingCode: item.trackingCode,
        status: item.status,
        estimated_delivery: item.estimated_delivery, // Snake_case no DB
        is_archived: item.is_archived,       // Snake_case no DB
        created_at: item.created_at,         // Snake_case no DB
        updated_at: item.updated_at,         // Snake_case no DB
        workspace_id: item.workspace_id,     // Snake_case no DB
      }));


      set({ transfers: formattedData || [], loading: false });
    });
  },

  createPurchase: async (purchaseData, products) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      // Campos da compra - Usando os nomes EXATOS das colunas do seu DB
      const dbPurchaseData = {
        date: purchaseData.date,
        carrier: purchaseData.carrier,
        storeName: purchaseData.storeName,       // storeName (camelCase)
        customer_name: purchaseData.customerName || null, // customer_name (snake_case)
        trackingCode: purchaseData.trackingCode, // trackingCode (camelCase)
        delivery_fee: purchaseData.deliveryFee,   // delivery_fee (snake_case)
        status: 'Aguardando rastreamento',
        is_archived: false,                       // is_archived (snake_case)
        workspace_id: currentWorkspace.id         // workspace_id (snake_case)
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

      // Campos dos produtos - Usando os nomes EXATOS das colunas do seu DB
      const productsWithPurchaseId = products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        cost: product.cost,
        SKU: product.sku,                       // SKU (UPPERCASE) -> Aqui que faltou a conexão!
        purchase_id: purchase.id,               // purchase_id (snake_case)
        is_verified: false,                     // is_verified (snake_case)
        is_in_stock: false,                     // is_in_stock (snake_case)
        vencimento: product.vencimento || null, // vencimento (camelCase)
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
        // Atualiza o status da compra, usando o trackingCode do formulário
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
      // Campos da compra para atualização - Usando os nomes EXATOS das colunas do seu DB
      const dbUpdates: any = {
        updated_at: new Date().toISOString() // updated_at (snake_case)
      };

      // Mapeando do Partial<Purchase> (input camelCase) para o DB (nomes mistos)
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      // customer_name (snake_case)
      if (updates.customer_name !== undefined) dbUpdates.customer_name = updates.customer_name;
      // trackingCode (camelCase)
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      // delivery_fee (snake_case)
      if (updates.delivery_fee !== undefined) dbUpdates.delivery_fee = updates.delivery_fee;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      // estimated_delivery (snake_case)
      if (updates.estimated_delivery !== undefined) dbUpdates.estimated_delivery = updates.estimated_delivery;
      // is_archived (snake_case)
      if (updates.is_archived !== undefined) dbUpdates.is_archived = updates.is_archived;


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
          is_archived: true, // is_archived (snake_case)
          updated_at: new Date().toISOString() // updated_at (snake_case)
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
      // Campos do produto para atualização - Usando os nomes EXATOS das colunas do seu DB
      const updates: { is_verified: boolean; updated_at: string; vencimento?: string | null } = { // snake_case
        is_verified: true, // is_verified (snake_case)
        updated_at: new Date().toISOString() // updated_at (snake_case)
      };
      if (vencimento !== undefined) {
        updates.vencimento = vencimento; // vencimento (camelCase)
      }

      const { error } = await supabase
        .from('purchase_products')
        .update(updates)
        .eq('id', productId)
        .eq('purchase_id', purchaseId); // purchase_id (snake_case)

      if (error) {
        console.error("Erro ao verificar produto:", error);
        throw error;
      }

      // Atualiza o estado local IMEDIATAMENTE - Usa os nomes EXATOS dos campos do DB para evitar incompatibilidade
      set((state) => ({
        purchases: state.purchases.map((purchase) =>
          purchase.id === purchaseId
            ? {
                ...purchase,
                products: (purchase.products || []).map((p) =>
                  p.id === productId ? { ...p, is_verified: true, vencimento: vencimento || p.vencimento } : p // is_verified (snake_case)
                ),
              }
            : purchase
        ),
      }));

      // Verifica se TODOS os produtos da compra estão verificados
      const { data: products, error: fetchProductsError } = await supabase
        .from('purchase_products')
        .select('is_verified') // is_verified (snake_case)
        .eq('purchase_id', purchaseId); // purchase_id (snake_case)

      if (fetchProductsError) {
        console.error("Erro ao buscar produtos para verificação total:", fetchProductsError);
        throw fetchProductsError;
      }

      const allVerified = (products || []).every(product => product.is_verified); // is_verified (snake_case)

      if (allVerified) {
        await supabase
          .from('purchases')
          .update({
            status: 'Produto entregue e conferido',
            updated_at: new Date().toISOString() // updated_at (snake_case)
          })
          .eq('id', purchaseId);
      }

      get().fetchPurchases();
    });
  },

  updateProductStatusToInStock: async (purchaseId, productId) => {
    await ErrorHandler.handleAsync(async () => {
      // Campos do produto para atualização - Usando os nomes EXATOS das colunas do seu DB
      const { error } = await supabase
        .from('purchase_products')
        .update({
          is_in_stock: true, // is_in_stock (snake_case)
          updated_at: new Date().toISOString() // updated_at (snake_case)
        })
        .eq('id', productId)
        .eq('purchase_id', purchaseId); // purchase_id (snake_case)

      if (error) {
        console.error("Erro ao adicionar produto ao estoque:", error);
        throw error;
      }

      // Atualiza o estado local IMEDIATAMENTE - Usa os nomes EXATOS dos campos do DB para evitar incompatibilidade
      set((state) => ({
        purchases: state.purchases.map((purchase) =>
          purchase.id === purchaseId
            ? {
                ...purchase,
                products: (purchase.products || []).map((p) =>
                  p.id === productId ? { ...p, is_in_stock: true } : p // is_in_stock (snake_case)
                ),
              }
            : purchase
        ),
      }));

      const { data: products, error: fetchProductsError } = await supabase
        .from('purchase_products')
        .select('is_in_stock') // is_in_stock (snake_case)
        .eq('purchase_id', purchaseId); // purchase_id (snake_case)

      if (fetchProductsError) {
        console.error("Erro ao buscar produtos para verificação de estoque total:", fetchProductsError);
        throw fetchProductsError;
      }

      const allInStock = (products || []).every(product => product.is_in_stock); // is_in_stock (snake_case)

      if (allInStock) {
        await supabase
          .from('purchases')
          .update({
            status: 'Adicionado ao estoque',
            is_archived: true, // is_archived (snake_case)
            updated_at: new Date().toISOString() // updated_at (snake_case)
          })
          .eq('id', purchaseId);
      }

      get().fetchPurchases();
    });
  },

  addProductToInventory: async (purchaseId) => {
    await ErrorHandler.handleAsync(async () => {
      console.log("Adicionando compra ao estoque:", purchaseId);

      // Campos do produto para atualização - Usando os nomes EXATOS das colunas do seu DB
      const { error: productsUpdateError } = await supabase
        .from('purchase_products')
        .update({
          is_in_stock: true, // is_in_stock (snake_case)
          updated_at: new Date().toISOString() // updated_at (snake_case)
        })
        .eq('purchase_id', purchaseId); // purchase_id (snake_case)

      if (productsUpdateError) {
        console.error("Erro ao atualizar produtos para 'em estoque':", productsUpdateError);
        throw productsUpdateError;
      }

      // Campos da compra para atualização - Usando os nomes EXATOS das colunas do seu DB
      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          is_archived: true, // is_archived (snake_case)
          status: 'Adicionado ao estoque',
          updated_at: new Date().toISOString() // updated_at (snake_case)
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

      // Campos da devolução - Usando os nomes EXATOS das colunas do seu DB
      const dbReturnData = {
        date: returnData.date,
        carrier: returnData.carrier,
        storeName: returnData.storeName,       // storeName (camelCase)
        customer_name: returnData.customerName, // customer_name (snake_case)
        trackingCode: returnData.trackingCode,   // trackingCode (camelCase)
        status: 'Aguardando rastreamento',
        is_archived: false,                       // is_archived (snake_case)
        workspace_id: currentWorkspace.id         // workspace_id (snake_case)
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
      // Campos da devolução para atualização - Usando os nomes EXATOS das colunas do seu DB
      const dbUpdates: any = {
        updated_at: new Date().toISOString() // updated_at (snake_case)
      };

      // Mapeando do Partial<Return> (input camelCase) para o DB (nomes mistos)
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customer_name !== undefined) dbUpdates.customer_name = updates.customer_name; // customer_name (snake_case)
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimated_delivery = updates.estimatedDelivery; // estimated_delivery (snake_case)
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived; // is_archived (snake_case)

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
          is_archived: true, // is_archived (snake_case)
          updated_at: new Date().toISOString() // updated_at (snake_case)
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

      // Campos da transferência - Usando os nomes EXATOS das colunas do seu DB
      const dbTransferData = {
        date: transferData.date,
        carrier: transferData.carrier,
        storeName: transferData.storeName,       // storeName (camelCase)
        customer_name: transferData.customerName, // customer_name (snake_case)
        trackingCode: transferData.trackingCode,   // trackingCode (camelCase)
        status: 'Aguardando rastreamento',
        is_archived: false,                       // is_archived (snake_case)
        workspace_id: currentWorkspace.id         // workspace_id (snake_case)
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
      // Campos da transferência para atualização - Usando os nomes EXATOS das colunas do seu DB
      const dbUpdates: any = {
        updated_at: new Date().toISOString() // updated_at (snake_case)
      };

      // Mapeando do Partial<Transfer> (input camelCase) para o DB (nomes mistos)
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
      if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
      if (updates.customer_name !== undefined) dbUpdates.customer_name = updates.customer_name; // customer_name (snake_case)
      if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.estimatedDelivery !== undefined) dbUpdates.estimated_delivery = updates.estimatedDelivery; // estimated_delivery (snake_case)
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived; // is_archived (snake_case)

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
          is_archived: true, // snake_case
          updated_at: new Date().toISOString() // snake_case
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
      // Select com o nome da coluna conforme o DB
      const { data: item } = await supabase
        .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
        .select('trackingCode, carrier') // trackingCode (camelCase)
        .eq('id', id)
        .single();

      if (!item) {
        console.error(`Item not found: ${type} ${id}`);
        return;
      }

      if (!item.trackingCode) { // trackingCode (camelCase)
        console.error(`No tracking code for ${type} ${id}`);
        return;
      }

      console.log(`Updating tracking for ${type} ${id}:`, item);

      try {
        const trackingInfo = await get().getTrackingInfo(item.carrier, item.trackingCode); // trackingCode (camelCase)

        if (!trackingInfo.success || !trackingInfo.data) {
          console.warn(`Failed to update tracking for ${type} ${id}:`, trackingInfo.error);
          return;
        }

        console.log(`Got tracking info for ${type} ${id}:`, trackingInfo);

        // Update com nomes de coluna conforme o DB
        await supabase
          .from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers')
          .update({
            status: trackingInfo.data.status,
            estimated_delivery: trackingInfo.data.estimatedDelivery, // estimated_delivery (snake_case)
            updated_at: new Date().toISOString()                      // updated_at (snake_case)
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
      // Filtrando com o nome da coluna conforme o DB
      const purchases = get().purchases.filter(p => !p.is_archived); // is_archived (snake_case)
      const returns = get().returns.filter(r => !r.is_archived);     // is_archived (snake_case)
      const transfers = get().transfers.filter(t => !t.is_archived); // is_archived (snake_case)

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
        // estimatedDelivery aqui virá da API externa no formato camelCase
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
        .eq('trackingCode', trackingCode) // trackingCode (camelCase)
        .maybeSingle();

      if (purchaseData) {
        // Mapeamento explícito de nomes de coluna do DB para o tipo TS do front-end
        const mappedPurchaseData: Purchase = {
          id: purchaseData.id,
          date: purchaseData.date,
          carrier: purchaseData.carrier,
          storeName: purchaseData.storeName,
          customer_name: purchaseData.customer_name, // snake_case
          trackingCode: purchaseData.trackingCode,
          delivery_fee: purchaseData.delivery_fee,   // snake_case
          status: purchaseData.status,
          estimated_delivery: purchaseData.estimated_delivery, // snake_case
          is_archived: purchaseData.is_archived,     // snake_case
          created_at: purchaseData.created_at,       // snake_case
          updated_at: purchaseData.updated_at,       // snake_case
          workspace_id: purchaseData.workspace_id,   // snake_case
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
        .eq('trackingCode', trackingCode) // trackingCode (camelCase)
        .maybeSingle();

      if (returnData) {
        const mappedReturnData: Return = {
          id: returnData.id,
          date: returnData.date,
          carrier: returnData.carrier,
          storeName: returnData.storeName,
          customer_name: returnData.customer_name, // snake_case
          trackingCode: returnData.trackingCode,
          status: returnData.status,
          estimated_delivery: returnData.estimated_delivery, // snake_case
          is_archived: returnData.is_archived,       // snake_case
          created_at: returnData.created_at,         // snake_case
          updated_at: returnData.updated_at,         // snake_case
          workspace_id: returnData.workspace_id,     // snake_case
        };
        return { type: 'return' as const, item: mappedReturnData };
      }

      const { data: transferData } = await supabase
        .from('transfers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('trackingCode', trackingCode) // trackingCode (camelCase)
        .maybeSingle();

      if (transferData) {
        const mappedTransferData: Transfer = {
          id: transferData.id,
          date: transferData.date,
          carrier: transferData.carrier,
          storeName: transferData.storeName,
          customer_name: transferData.customer_name, // snake_case
          trackingCode: transferData.trackingCode,
          status: transferData.status,
          estimated_delivery: transferData.estimated_delivery, // snake_case
          is_archived: transferData.is_archived,       // snake_case
          created_at: transferData.created_at,         // snake_case
          updated_at: transferData.updated_at,         // snake_case
          workspace_id: transferData.workspace_id,     // snake_case
        };
        return { type: 'transfer' as const, item: mappedTransferData };
      }

      return null;
    }) || null;
  }
}));