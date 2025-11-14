import { useEffect, useRef } from 'react';
import { useBaselinkerStore } from '@/store/baselinkerStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * Componente invisível que gerencia sincronização automática do Baselinker
 * Deve ser montado uma única vez no layout principal
 */
export function BaselinkerAutoSync() {
  const { isConnected, connect, syncAll } = useBaselinkerStore();
  const { currentWorkspace } = useWorkspaceStore();
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    console.log('[BASELINKER AUTO-SYNC] Verificando workspace...', {
      hasWorkspace: !!currentWorkspace,
      workspaceId: currentWorkspace?.id
    });

    // Só executar se tiver workspace
    if (!currentWorkspace) {
      console.log('[BASELINKER AUTO-SYNC] ⚠️ Aguardando workspace...');
      return;
    }

    // Obter configuração de sincronização do workspace
    const baselinkerSettings = currentWorkspace?.settings?.baselinker;

    // Verificar se Baselinker está configurado
    if (!baselinkerSettings || !baselinkerSettings.token) {
      console.log('[BASELINKER AUTO-SYNC] ⚠️ Baselinker não configurado neste workspace');
      return;
    }

    const syncInterval = baselinkerSettings?.sync_interval || 30; // Padrão: 30 minutos

    console.log(`[BASELINKER AUTO-SYNC] ✅ Baselinker configurado! Iniciando sincronização automática a cada ${syncInterval} minutos`);

    // Inicializar conexão do Baselinker se não estiver conectado
    const initializeConnection = async () => {
      if (initializingRef.current) return;

      try {
        initializingRef.current = true;

        if (!isConnected()) {
          console.log('[BASELINKER AUTO-SYNC] Inicializando conexão com Baselinker...');

          await connect({
            apiKey: baselinkerSettings.token,
            syncInterval: syncInterval,
            syncOrders: baselinkerSettings.sync_orders !== false,
            syncCustomers: baselinkerSettings.sync_customers !== false,
            syncInventory: baselinkerSettings.sync_inventory !== false,
            orderStatuses: baselinkerSettings.order_statuses || ['new', 'paid', 'processing', 'ready_for_shipping', 'shipped'],
            inventoryId: baselinkerSettings.inventory_id || '',
          });

          console.log('[BASELINKER AUTO-SYNC] ✅ Conexão inicializada com sucesso!');
        }
      } catch (error) {
        console.error('[BASELINKER AUTO-SYNC] ❌ Erro ao inicializar conexão:', error);
      } finally {
        initializingRef.current = false;
      }
    };

    // Inicializar antes de começar as sincronizações
    initializeConnection();

    // Função para executar sincronização
    const runSync = async () => {
      try {
        const now = new Date();
        console.log(`[BASELINKER AUTO-SYNC] 🔄 Executando sincronização automática às ${now.toLocaleTimeString('pt-BR')}`);

        await syncAll();

        console.log(`[BASELINKER AUTO-SYNC] ✅ Sincronização concluída com sucesso às ${new Date().toLocaleTimeString('pt-BR')}`);
      } catch (error) {
        console.error('[BASELINKER AUTO-SYNC] ❌ Erro na sincronização:', error);
      }
    };

    // Executar primeira sincronização após 10 segundos (dar tempo do app carregar)
    console.log('[BASELINKER AUTO-SYNC] ⏰ Primeira sincronização em 10 segundos...');
    const initialTimeout = setTimeout(() => {
      console.log('[BASELINKER AUTO-SYNC] 🚀 Executando sincronização inicial...');
      runSync();
    }, 10000); // 10 segundos

    // Configurar intervalo de sincronização
    const intervalMs = syncInterval * 60 * 1000; // Converter minutos para ms
    intervalIdRef.current = setInterval(runSync, intervalMs);

    console.log(`[BASELINKER AUTO-SYNC] ⏰ Sincronizações automáticas configuradas (intervalo: ${syncInterval} min)`);

    // Cleanup
    return () => {
      console.log('[BASELINKER AUTO-SYNC] 🛑 Parando sincronização automática');
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      clearTimeout(initialTimeout);
    };
  }, [currentWorkspace?.id]); // Removido isConnected() das dependências!

  // Componente invisível - não renderiza nada
  return null;
}
