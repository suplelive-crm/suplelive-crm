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
    observation?: string; // Novo campo não obrigatório
}

// CORREÇÃO: A interface agora usa 'SKU' (maiúsculo)
type FormProduct = Partial<{
    id: string | number;
    name: string;
    SKU: string;
    quantity: number;
    cost: number;
}>

interface TrackingState {
    purchases: Purchase[];
    returns: Return[];
    transfers: Transfer[];
    viewMode: 'table' | 'kanban';
    showArchived: boolean;
    loading: boolean;
    setViewMode: (mode: 'table' | 'kanban') => void;
    setShowArchived: (show: boolean) => void;
    fetchPurchases: () => Promise<void>;
    fetchReturns: () => Promise<void>;
    fetchTransfers: () => Promise<void>;
    createPurchase: (purchaseData: PurchaseFormData, products: FormProduct[]) => Promise<void>;
    updatePurchase: (purchaseId: string, formData: PurchaseFormData, products: FormProduct[]) => Promise<void>;
    archivePurchase: (id: string) => Promise<void>;
    deletePurchase: (purchaseId: string) => Promise<void>;
    verifyPurchaseProduct: (purchaseId: string, productId: string, vencimento?: string, preco_ml?: number, preco_atacado?: number) => Promise<void>;
    addProductToInventory: (purchaseId: string) => Promise<void>;
    updateProductStatusToInStock: (purchaseId: string, productId: string) => Promise<void>;
    verifyTransferProduct: (transferId: string, productId: string) => Promise<void>;
    addTransferToInventory: (transferId: string) => Promise<void>;
    updateTransferStatus: (transferId: string, status: 'conferido' | 'in_stock' | 'retirado_stock', value: boolean) => Promise<void>;
    archiveTransfer: (id: string) => Promise<void>;
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
    createTransfer: (transferData: {
        date: string;
        carrier: string;
        storeName: string;
        customerName: string;
        trackingCode: string;
        source_stock: string;
        destination_stock: string;
        products: Array<{
            name: string;
            quantity: number;
            sku?: string;
        }>;
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
                    products:purchase_products(
                        id,
                        purchase_id,
                        name,
                        quantity,
                        cost,
                        total_cost,
                        is_verified,
                        is_in_stock,
                        vencimento,
                        SKU, 
                        preco_ml,
                        preco_atacado
                    )
                `)
                .eq('workspace_id', currentWorkspace.id)
                .order('date', { ascending: false });

            if (!get().showArchived) {
                query = query.eq('is_archived', false);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data) {
                set({ purchases: [], loading: false });
                return;
            }
            
            const formattedData: Purchase[] = data.map((purchase: any) => ({
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
                metadata: purchase.metadata || null,
                observation: purchase.observation,
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
                    SKU: product.SKU || '',
                    preco_ml: product.preco_ml,
                    preco_atacado: product.preco_atacado,
                }))
            }));

            set({ purchases: formattedData, loading: false });
        });
    },

    fetchReturns: async () => {
        await ErrorHandler.handleAsync(async () => {
            set({ loading: true });
            const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
            if (!currentWorkspace) return;
            let query = supabase.from('returns').select('*, metadata').eq('workspace_id', currentWorkspace.id).order('date', { ascending: false });
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
                metadata: item.metadata,
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
                .select(`
                    *,
                    products:transfer_products(*)
                `)
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
                source_stock: item.source_stock,
                destination_stock: item.destination_stock,
                metadata: item.metadata,
                products: (item.products || []).map((product: any) => ({
                    id: product.id,
                    transfer_id: product.transfer_id,
                    name: product.name,
                    quantity: product.quantity,
                    sku: product.sku,
                    is_verified: product.is_verified,
                    created_at: product.created_at,
                    updated_at: product.updated_at,
                }))
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
                workspace_id: currentWorkspace.id,
                metadata: [],
                observation: purchaseData.observation || null,
            };
            const { data: purchase, error: purchaseError } = await supabase.from('purchases').insert(dbPurchaseData).select().single();
            if (purchaseError) throw purchaseError;
            const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
            const deliveryFeePerUnit = totalQuantity > 0 ? purchaseData.delivery_fee / totalQuantity : 0;
            const productsWithPurchaseId = products.map(product => ({
                name: product.name,
                quantity: product.quantity,
                cost: parseFloat(((product.cost || 0) + deliveryFeePerUnit).toFixed(2)),
                SKU: product.SKU, 
                purchase_id: purchase.id,
                is_verified: false,
                is_in_stock: false,
                vencimento: (product as any).vencimento || null,
                preco_ml: (product as any).preco_ml || null,
                preco_atacado: (product as any).preco_atacado || null,
            }));
            const { error: productsError } = await supabase.from('purchase_products').insert(productsWithPurchaseId);
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
            const { error: purchaseError } = await supabase.from('purchases').update({
                date: formData.date,
                carrier: formData.carrier,
                storeName: formData.storeName,
                customer_name: formData.customer_name || null,
                trackingCode: formData.trackingCode,
                delivery_fee: formData.delivery_fee,
                observation: formData.observation || null,
                updated_at: new Date().toISOString(),
            }).eq('id', purchaseId);
            if (purchaseError) throw purchaseError;
            
            const formProductIds = products.map(p => p.id).filter(Boolean);
            const { data: existingDbProducts, error: fetchError } = await supabase.from('purchase_products').select('id').eq('purchase_id', purchaseId);
            if (fetchError) throw fetchError;

            const dbProductIds = (existingDbProducts || []).map(p => p.id);
            const productsToDeleteIds = dbProductIds.filter(id => !formProductIds.includes(id as string));
            if (productsToDeleteIds.length > 0) {
                const { error: deleteError } = await supabase.from('purchase_products').delete().in('id', productsToDeleteIds);
                if (deleteError) throw deleteError;
            }

            const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
            const deliveryFeePerUnit = totalQuantity > 0 ? formData.delivery_fee / totalQuantity : 0;
            
            const productsToUpdate = products.filter(p => p.id);
            const productsToInsert = products.filter(p => !p.id);

            if (productsToUpdate.length > 0) {
                const updatePayload = productsToUpdate.map(product => ({
                    id: product.id,
                    purchase_id: purchaseId,
                    name: product.name,
                    SKU: product.SKU, 
                    quantity: product.quantity,
                    cost: parseFloat(((product.cost || 0) + deliveryFeePerUnit).toFixed(2)),
                }));

                console.log("Enviando para o UPDATE:", JSON.stringify(updatePayload, null, 2));
                const { error: updateError } = await supabase.from('purchase_products').upsert(updatePayload);
                if (updateError) {
                    console.error("Erro no UPDATE de produtos:", updateError);
                    throw updateError;
                }
            }

            if (productsToInsert.length > 0) {
                const insertPayload = productsToInsert.map(product => ({
                    purchase_id: purchaseId,
                    name: product.name,
                    SKU: product.SKU, 
                    quantity: product.quantity,
                    cost: parseFloat(((product.cost || 0) + deliveryFeePerUnit).toFixed(2)),
                    is_verified: false,
                    is_in_stock: false,
                    vencimento: null,
                    preco_ml: null,
                    preco_atacado: null,
                }));
                
                console.log("Enviando para o INSERT:", JSON.stringify(insertPayload, null, 2));
                const { error: insertError } = await supabase.from('purchase_products').insert(insertPayload);
                if (insertError) {
                    console.error("Erro no INSERT de novos produtos:", insertError);
                    throw insertError;
                }
            }
            
            await get().fetchPurchases();
            ErrorHandler.showSuccess('Compra atualizada com sucesso!');
        });
    },

    archivePurchase: async (id) => {
        await ErrorHandler.handleAsync(async () => {
            const { error } = await supabase.from('purchases').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) { console.error("Error archiving purchase:", error); throw error; }
            get().fetchPurchases();
            ErrorHandler.showSuccess('Compra arquivada com sucesso!');
        });
    },

    deletePurchase: async (purchaseId: string) => {
        await ErrorHandler.handleAsync(async () => {
            const { error } = await supabase.rpc('delete_purchase_and_products', { p_id: purchaseId });
            if (error) { console.error("Erro ao deletar o pedido de compra:", error); throw error; }
            set((state) => ({ purchases: state.purchases.filter((p) => p.id !== purchaseId) }));
            ErrorHandler.showSuccess('Pedido de compra deletado com sucesso!');
        });
    },

    verifyPurchaseProduct: async (purchaseId, productId, vencimento, preco_ml, preco_atacado) => {
        await ErrorHandler.handleAsync(async () => {
            const { data: currentProduct, error: fetchError } = await supabase.from('purchase_products').select('vencimento, preco_ml, preco_atacado').eq('id', productId).eq('purchase_id', purchaseId).single();
            if (fetchError) throw fetchError;
            const updatedVencimento = vencimento || currentProduct?.vencimento;
            const updatedPrecoMl = preco_ml !== undefined ? preco_ml : currentProduct?.preco_ml;
            const updatedPrecoAtacado = preco_atacado !== undefined ? preco_atacado : currentProduct?.preco_atacado;
            const isVerified = !!updatedVencimento && (updatedPrecoMl !== undefined && updatedPrecoMl !== null) && (updatedPrecoAtacado !== undefined && updatedPrecoAtacado !== null);
            const updates: any = { is_verified: isVerified, updated_at: new Date().toISOString() };
            if (updatedVencimento !== undefined) { updates.vencimento = updatedVencimento; }
            if (updatedPrecoMl !== undefined) { updates.preco_ml = updatedPrecoMl; }
            if (updatedPrecoAtacado !== undefined) { updates.preco_atacado = updatedPrecoAtacado; }
            const { error } = await supabase.from('purchase_products').update(updates).eq('id', productId).eq('purchase_id', purchaseId);
            if (error) { console.error("Erro ao verificar produto:", error); throw error; }
            const { data: purchaseData, error: purchaseError } = await supabase.from('purchases').select('status, is_archived, products:purchase_products(*)').eq('id', purchaseId).single();
            if (purchaseError) throw purchaseError;
            const currentPurchase = purchaseData as Purchase;
            const finalProductList = currentPurchase.products.map(p => {
                if (p.id === productId) { return { ...p, is_verified: isVerified, vencimento: updatedVencimento, preco_ml: updatedPrecoMl, preco_atacado: updatedPrecoAtacado }; }
                return p;
            });
            let newStatus = currentPurchase.status;
            const allProductsVerified = finalProductList.every(p => p.is_verified);
            if (allProductsVerified) {
                newStatus = 'Produto entregue e conferido';
            } else {
                const conferredParts = [];
                if (finalProductList.some(p => !!p.vencimento)) conferredParts.push('Vencimento');
                if (finalProductList.some(p => p.preco_ml !== undefined && p.preco_ml !== null)) conferredParts.push('Preço ML');
                if (finalProductList.some(p => p.preco_atacado !== undefined && p.preco_atacado !== null)) conferredParts.push('Preço Atacado');
                if (conferredParts.length > 0) {
                    newStatus = `Produto entregue - ${conferredParts.join(' & ')} conferido(s)`;
                } else {
                    if (!currentPurchase.is_archived && currentPurchase.status?.toLowerCase().includes('entregue')) {
                        newStatus = 'Entregue';
                    }
                }
            }
            await supabase.from('purchases').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', purchaseId);
            set((state) => ({
                purchases: state.purchases.map((purchase) =>
                    purchase.id === purchaseId ? { ...purchase, status: newStatus, products: finalProductList } : purchase
                ),
            }));
            get().fetchPurchases();
        });
    },

    updateProductStatusToInStock: async (purchaseId, productId) => {
        await ErrorHandler.handleAsync(async () => {
            const { error } = await supabase.from('purchase_products').update({ is_in_stock: true, updated_at: new Date().toISOString() }).eq('id', productId).eq('purchase_id', purchaseId);
            if (error) { console.error("Erro ao adicionar produto ao estoque:", error); throw error; }
            set((state) => ({
                purchases: state.purchases.map((purchase) =>
                    purchase.id === purchaseId
                        ? { ...purchase, products: (purchase.products || []).map((p) => p.id === productId ? { ...p, is_in_stock: true } : p) }
                        : purchase
                ),
            }));
            const { data: products, error: fetchProductsError } = await supabase.from('purchase_products').select('is_in_stock').eq('purchase_id', purchaseId);
            if (fetchProductsError) { console.error("Erro ao buscar produtos para verificação de estoque total:", fetchProductsError); throw fetchProductsError; }
            const allInStock = (products || []).every(product => product.is_in_stock);
            if (allInStock) {
                await supabase.from('purchases').update({ status: 'Adicionado ao estoque', is_archived: true, updated_at: new Date().toISOString() }).eq('id', purchaseId);
            }
            get().fetchPurchases();
        });
    },

    addProductToInventory: async (purchaseId) => {
        await ErrorHandler.handleAsync(async () => {
            const { error: productsUpdateError } = await supabase.from('purchase_products').update({ is_in_stock: true, updated_at: new Date().toISOString() }).eq('purchase_id', purchaseId);
            if (productsUpdateError) { console.error("Erro ao atualizar produtos para 'em estoque':", productsUpdateError); throw productsUpdateError; }
            const { error: purchaseUpdateError } = await supabase.from('purchases').update({ is_archived: true, status: 'Adicionado ao estoque', updated_at: new Date().toISOString() }).eq('id', purchaseId);
            if (purchaseUpdateError) { console.error("Erro ao adicionar compra ao estoque:", purchaseUpdateError); throw purchaseUpdateError; }
            get().fetchPurchases();
            ErrorHandler.showSuccess('Compra e produtos adicionados ao estoque!');
        });
    },

    verifyTransferProduct: async (transferId: string, productId: string) => {
        await ErrorHandler.handleAsync(async () => {
            const { error } = await supabase
                .from('transfer_products')
                .update({ 
                    is_verified: true, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', productId)
                .eq('transfer_id', transferId);

            if (error) {
                console.error("Erro ao verificar produto da transferência:", error);
                throw error;
            }

            // Check if all products are verified, then update transfer status
            const { data: allProducts, error: fetchError } = await supabase
                .from('transfer_products')
                .select('is_verified')
                .eq('transfer_id', transferId);

            if (fetchError) {
                console.error("Erro ao buscar produtos da transferência:", fetchError);
                throw fetchError;
            }

            const allVerified = allProducts?.every(p => p.is_verified) || false;
            
            if (allVerified) {
                await supabase
                    .from('transfers')
                    .update({ 
                        conferido: true,
                        status: 'Conferido',
                        updated_at: new Date().toISOString() 
                    })
                    .eq('id', transferId);
            }

            get().fetchTransfers();
            ErrorHandler.showSuccess('Produto da transferência verificado com sucesso!');
        });
    },

    addTransferToInventory: async (transferId) => {
        await ErrorHandler.handleAsync(async () => {
            // Mark all products as verified and update transfer status
            const { error: productsUpdateError } = await supabase
                .from('transfer_products')
                .update({ 
                    is_verified: true, 
                    updated_at: new Date().toISOString() 
                })
                .eq('transfer_id', transferId);

            if (productsUpdateError) {
                console.error("Erro ao atualizar produtos da transferência:", productsUpdateError);
                throw productsUpdateError;
            }

            const { error: transferUpdateError } = await supabase
                .from('transfers')
                .update({ 
                    conferido: true,
                    in_stock: true,
                    retirado_stock: true,
                    status: 'Lançado no estoque', 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', transferId);

            if (transferUpdateError) {
                console.error("Erro ao finalizar transferência:", transferUpdateError);
                throw transferUpdateError;
            }

            get().fetchTransfers();
            ErrorHandler.showSuccess('Transferência lançada no estoque com sucesso!');
        });
    },

    updateTransferStatus: async (transferId: string, status: 'conferido' | 'in_stock' | 'retirado_stock', value: boolean) => {
        await ErrorHandler.handleAsync(async () => {
            const updateData: any = { 
                [status]: value,
                updated_at: new Date().toISOString() 
            };

            // Update status text based on the flags
            if (status === 'conferido' && value) {
                updateData.status = 'Conferido';
            } else if (status === 'in_stock' && value) {
                updateData.status = 'Lançado no estoque';
            }

            const { error } = await supabase
                .from('transfers')
                .update(updateData)
                .eq('id', transferId);

            if (error) {
                console.error("Erro ao atualizar status da transferência:", error);
                throw error;
            }

            get().fetchTransfers();
            ErrorHandler.showSuccess('Status da transferência atualizado com sucesso!');
        });
    },

    archiveTransfer: async (id) => {
        await ErrorHandler.handleAsync(async () => {
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

    createReturn: async (returnData) => {
        await ErrorHandler.handleAsync(async () => {
            const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
            if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
            const dbReturnData = {
                date: returnData.date,
                carrier: returnData.carrier,
                storeName: returnData.storeName,
                customer_name: returnData.customerName,
                trackingCode: returnData.trackingCode,
                status: 'Aguardando rastreamento',
                is_archived: false,
                workspace_id: currentWorkspace.id,
                metadata: []
            };
            const { data: newReturn, error } = await supabase.from('returns').insert(dbReturnData).select().single();
            if (error) { console.error("Error creating return:", error); throw error; }
            try {
                if (newReturn) { await get().updateTrackingStatus('return', newReturn.id); }
            } catch (error) {
                console.warn("Could not update tracking status for new return:", error);
            }
            get().fetchReturns();
            ErrorHandler.showSuccess('Devolução criada com sucesso!');
        });
    },

    updateReturn: async (id, updates) => {
        await ErrorHandler.handleAsync(async () => {
            const dbUpdates: any = { updated_at: new Date().toISOString() };
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
            const { error } = await supabase.from('returns').update(dbUpdates).eq('id', id);
            if (error) throw error;
            get().fetchReturns();
            ErrorHandler.showSuccess('Devolução atualizada com sucesso!');
        });
    },

    archiveReturn: async (id) => {
        await ErrorHandler.handleAsync(async () => {
            const { error } = await supabase.from('returns').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) { console.error("Error archiving return:", error); throw error; }
            get().fetchReturns();
            ErrorHandler.showSuccess('Devolução arquivada com sucesso!');
        });
    },

    verifyReturn: async (id: string, verification_observations?: string) => {
        await ErrorHandler.handleAsync(async () => {
            const updateData: any = { is_verified: true, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            if (verification_observations && verification_observations.trim() !== '') {
                updateData.verification_observations = verification_observations;
            }
            const { error } = await supabase.from('returns').update(updateData).eq('id', id);
            if (error) { console.error("Erro ao verificar devolução:", error); throw error; }
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
                source_stock: transferData.source_stock,
                destination_stock: transferData.destination_stock,
                status: 'Aguardando rastreamento',
                is_archived: false,
                workspace_id: currentWorkspace.id,
                metadata: []
            };
            const { data: newTransfer, error } = await supabase.from('transfers').insert(dbTransferData).select().single();
            if (error) { console.error("Error creating transfer:", error); throw error; }
            
            // Create transfer products
            if (transferData.products && transferData.products.length > 0) {
                const productsWithTransferId = transferData.products.map(product => ({
                    transfer_id: newTransfer.id,
                    name: product.name,
                    quantity: product.quantity,
                    sku: product.sku || '',
                    is_verified: false,
                }));
                
                const { error: productsError } = await supabase
                    .from('transfer_products')
                    .insert(productsWithTransferId);
                
                if (productsError) {
                    console.error("Error creating transfer products:", productsError);
                    throw productsError;
                }
            }
            
            try {
                if (newTransfer) { await get().updateTrackingStatus('transfer', newTransfer.id); }
            } catch (error) {
                console.warn("Could not update tracking status for new transfer:", error);
            }
            get().fetchTransfers();
            ErrorHandler.showSuccess('Transferência criada com sucesso!');
        });
    },

    updateTransfer: async (id, updates) => {
        await ErrorHandler.handleAsync(async () => {
            const dbUpdates: any = { updated_at: new Date().toISOString() };
            if (updates.date !== undefined) dbUpdates.date = updates.date;
            if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier;
            if (updates.storeName !== undefined) dbUpdates.storeName = updates.storeName;
            if (updates.customer_name !== undefined) dbUpdates.customer_name = updates.customer_name;
            if (updates.trackingCode !== undefined) dbUpdates.trackingCode = updates.trackingCode;
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.estimated_delivery !== undefined) dbUpdates.estimated_delivery = updates.estimated_delivery;
            if (updates.is_archived !== undefined) dbUpdates.is_archived = updates.is_archived;
            const { error } = await supabase.from('transfers').update(dbUpdates).eq('id', id);
            if (error) throw error;
            get().fetchTransfers();
            ErrorHandler.showSuccess('Transferência atualizada com sucesso!');
        });
    },

    archiveTransfer: async (id) => {
        await ErrorHandler.handleAsync(async () => {
            const { error } = await supabase.from('transfers').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) { console.error("Error archiving transfer:", error); throw error; }
            get().fetchTransfers();
            ErrorHandler.showSuccess('Transferência arquivada com sucesso!');
        });
    },

    updateTrackingStatus: async (type, id) => {
        await ErrorHandler.handleAsync(async () => {
            const { data: item } = await supabase.from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers').select('trackingCode, carrier').eq('id', id).single();
            if (!item || !item.trackingCode) { return; }
            try {
                const trackingInfo = await get().getTrackingInfo(item.carrier, item.trackingCode);
                if (!trackingInfo.success || !trackingInfo.data) { throw new Error(trackingInfo.error || 'Falha ao rastrear objeto'); }
                await supabase.from(type === 'purchase' ? 'purchases' : type === 'return' ? 'returns' : 'transfers').update({
                    status: trackingInfo.data.status,
                    estimated_delivery: trackingInfo.data.estimatedDelivery,
                    metadata: trackingInfo.data.history,
                    updated_at: new Date().toISOString()
                }).eq('id', id);
                if (type === 'purchase') get().fetchPurchases();
                else if (type === 'return') get().fetchReturns();
                else if (type === 'transfer') get().fetchTransfers();
            } catch (error) {
                console.error(`Error updating ${item.carrier} tracking for ${type} ${id}:`, error);
            }
        });
    },

    findItemByTrackingCode: async (trackingCode: string) => {
        return await ErrorHandler.handleAsync(async () => {
            if (!trackingCode) return null;
            const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
            if (!currentWorkspace) return null;
            const { data: purchaseData } = await supabase.from('purchases').select(`*, products:purchase_products(*), metadata`).eq('workspace_id', currentWorkspace.id).eq('trackingCode', trackingCode).maybeSingle();
            if (purchaseData) {
                const mappedPurchaseData: Purchase = {
                    ...purchaseData,
                    products: (purchaseData.products || []).map((p) => ({ ...p })) as PurchaseProduct[],
                    metadata: purchaseData.metadata,
                    observation: purchaseData.observation,
                } as Purchase;
                return { type: 'purchase', item: mappedPurchaseData };
            }
            const { data: returnData } = await supabase.from('returns').select('*, metadata').eq('workspace_id', currentWorkspace.id).eq('trackingCode', trackingCode).maybeSingle();
            if (returnData) { return { type: 'return', item: returnData as Return }; }
            const { data: transferData } = await supabase.from('transfers').select('*, metadata').eq('workspace_id', currentWorkspace.id).eq('trackingCode', trackingCode).maybeSingle();
            if (transferData) { return { type: 'transfer', item: transferData as Transfer }; }
            return null;
        }) || null;
    },

    updateAllTrackingStatuses: async () => {
        // Intentionally left empty
    },

    getTrackingInfo: async (carrier: string, trackingCode: string) => {
        try {
            if (!carrier || !trackingCode) { return { success: false, error: 'Transportadora ou código de rastreio não informados' }; }
            const trackingData = await trackPackage(carrier, trackingCode);
            if (trackingData.success) {
                const parsedData = parseTrackingResponse(carrier, trackingData);
                return { success: true, data: parsedData };
            } else {
                return { success: false, error: (trackingData).message || 'Falha ao rastrear objeto' };
            }
        } catch (error) {
            console.error('Error tracking package:', error);
            return { success: false, error: (error).message || 'Falha ao rastrear objeto' };
        }
    },
}));