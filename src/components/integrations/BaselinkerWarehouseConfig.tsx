import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { supabase } from '@/lib/supabase';
import { getBaselinker } from '@/lib/baselinker-api';
import { toast } from 'sonner';
import { Loader2, Warehouse, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BaselinkerWarehouse {
  id?: string;
  workspace_id: string;
  warehouse_id: string;
  warehouse_name: string;
  is_active: boolean;
  allow_stock_updates: boolean;
  sync_direction: 'read_only' | 'write_only' | 'bidirectional';
}

interface BaselinkerInventory {
  inventory_id: string;
  name: string;
  description?: string;
}

interface BaselinkerWarehouseFromAPI {
  warehouse_id: string;
  name: string;
  description?: string;
  inventory_id: string;
  inventory_name: string;
}

export function BaselinkerWarehouseConfig() {
  const { currentWorkspace } = useWorkspaceStore();
  const [warehouses, setWarehouses] = useState<BaselinkerWarehouse[]>([]);
  const [availableWarehouses, setAvailableWarehouses] = useState<BaselinkerWarehouseFromAPI[]>([]);
  const [availableInventories, setAvailableInventories] = useState<BaselinkerInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadSavedWarehouses();
    }
  }, [currentWorkspace?.id]);

  const loadSavedWarehouses = async () => {
    try {
      setLoading(true);

      // Buscar configuração salva no banco
      const { data: savedWarehouses, error: warehouseError } = await supabase
        .from('baselinker_warehouses')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id);

      if (warehouseError) {
        throw warehouseError;
      }

      setWarehouses(savedWarehouses || []);
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      await loadSavedWarehouses();
      await loadAvailableInventories();
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
      toast.error('Erro ao carregar configuração de warehouses');
    }
  };

  const loadAvailableInventories = async () => {
    try {
      setRefreshing(true);

      const baselinker = getBaselinker();
      if (!baselinker) {
        throw new Error('Baselinker não está inicializado. Configure a API Key primeiro.');
      }

      // Buscar API Key do localStorage (salva pelo baselinkerStore)
      const configKey = `baselinker_config_${currentWorkspace!.id}`;
      const savedConfig = localStorage.getItem(configKey);

      if (!savedConfig) {
        throw new Error('Configuração do Baselinker não encontrada. Configure a API Key na página de Integrações.');
      }

      const config = JSON.parse(savedConfig);
      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('API Key do Baselinker não configurada');
      }

      // Buscar inventories via API
      const inventoriesResponse = await baselinker.getInventories(apiKey);
      const warehousesResponse = await baselinker.getInventoryWarehouses(apiKey);

      // Processar inventories
      if (inventoriesResponse.inventories) {
        const inventories = Object.entries(inventoriesResponse.inventories).map(([id, data]: [string, any]) => ({
          inventory_id: id,
          name: data.name || `Inventory ${id}`,
          description: data.description,
        }));

        setAvailableInventories(inventories);
      }

      // Processar warehouses
      if (warehousesResponse.warehouses) {
        const warehouses: BaselinkerWarehouseFromAPI[] = Object.entries(warehousesResponse.warehouses).map(([whId, whData]: [string, any]) => {
          // Encontrar o inventory correspondente (se warehouse_type === 'bl')
          const inventoryId = inventoriesResponse.inventories ? Object.keys(inventoriesResponse.inventories)[0] : '0';
          const inventoryName = inventoriesResponse.inventories?.[inventoryId]?.name || 'Baselinker Inventory';

          return {
            warehouse_id: whId,
            name: whData.name || `Warehouse ${whId}`,
            description: whData.description,
            inventory_id: inventoryId,
            inventory_name: inventoryName,
          };
        });

        setAvailableWarehouses(warehouses);
      }
    } catch (error: any) {
      console.error('Error loading inventories:', error);
      toast.error(error.message || 'Erro ao buscar warehouses do Baselinker');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleWarehouse = async (warehouseId: string, isActive: boolean) => {
    try {
      setSaving(true);

      const warehouse = availableWarehouses.find(wh => wh.warehouse_id === warehouseId);
      const existingWarehouse = warehouses.find(w => w.warehouse_id === warehouseId);

      if (existingWarehouse) {
        // Update existing
        const { error } = await supabase
          .from('baselinker_warehouses')
          .update({ is_active: isActive })
          .eq('id', existingWarehouse.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('baselinker_warehouses')
          .insert({
            workspace_id: currentWorkspace!.id,
            warehouse_id: warehouseId,
            warehouse_name: warehouse?.name || `Warehouse ${warehouseId}`,
            is_active: isActive,
            allow_stock_updates: true,
            sync_direction: 'bidirectional',
          });

        if (error) throw error;
      }

      toast.success(isActive ? 'Estoque ativado' : 'Estoque desativado');
      await loadWarehouses();
    } catch (error: any) {
      console.error('Error toggling warehouse:', error);
      toast.error('Erro ao atualizar estoque');
    } finally {
      setSaving(false);
    }
  };

  const updateSyncDirection = async (warehouseId: string, direction: 'read_only' | 'write_only' | 'bidirectional') => {
    try {
      setSaving(true);

      const warehouse = warehouses.find(w => w.warehouse_id === warehouseId);
      if (!warehouse) return;

      const { error } = await supabase
        .from('baselinker_warehouses')
        .update({ sync_direction: direction })
        .eq('id', warehouse.id);

      if (error) throw error;

      toast.success('Direção de sincronização atualizada');
      await loadWarehouses();
    } catch (error: any) {
      console.error('Error updating sync direction:', error);
      toast.error('Erro ao atualizar direção de sincronização');
    } finally {
      setSaving(false);
    }
  };

  const updateStockUpdates = async (warehouseId: string, allowUpdates: boolean) => {
    try {
      setSaving(true);

      const warehouse = warehouses.find(w => w.warehouse_id === warehouseId);
      if (!warehouse) return;

      const { error } = await supabase
        .from('baselinker_warehouses')
        .update({ allow_stock_updates: allowUpdates })
        .eq('id', warehouse.id);

      if (error) throw error;

      toast.success(allowUpdates ? 'Atualização de estoque ativada' : 'Atualização de estoque desativada');
      await loadWarehouses();
    } catch (error: any) {
      console.error('Error updating stock updates:', error);
      toast.error('Erro ao atualizar permissão de estoque');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Warehouses Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Warehouses Ativos
            </CardTitle>
            <CardDescription className="mt-2">
              Selecione quais warehouses a plataforma pode modificar automaticamente
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAvailableInventories}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {availableWarehouses.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum estoque encontrado. Configure a API Key do Baselinker primeiro.
            </AlertDescription>
          </Alert>
        ) : (
          availableInventories.map((inventory) => {
            // Filtrar warehouses deste inventory
            const warehousesOfInventory = availableWarehouses.filter(
              wh => wh.inventory_id === inventory.inventory_id
            );

            if (warehousesOfInventory.length === 0) return null;

            return (
              <div key={inventory.inventory_id} className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  {inventory.name}
                </h3>

                <div className="space-y-3 ml-6">
                  {warehousesOfInventory.map((warehouse) => {
                    const config = warehouses.find(w => w.warehouse_id === warehouse.warehouse_id);
                    const isActive = config?.is_active || false;
                    const allowStockUpdates = config?.allow_stock_updates ?? true;
                    const syncDirection = config?.sync_direction || 'bidirectional';

                    return (
                      <div
                        key={warehouse.warehouse_id}
                        className="border rounded-lg p-4 space-y-4 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Label
                                htmlFor={`warehouse-${warehouse.warehouse_id}`}
                                className="text-base font-medium cursor-pointer"
                              >
                                {warehouse.name}
                              </Label>
                              {isActive ? (
                                <Badge variant="default" className="bg-green-500">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              ID: {warehouse.warehouse_id}
                              {warehouse.description && ` • ${warehouse.description}`}
                            </p>
                          </div>
                          <Switch
                            id={`warehouse-${warehouse.warehouse_id}`}
                            checked={isActive}
                            onCheckedChange={(checked) => toggleWarehouse(warehouse.warehouse_id, checked)}
                            disabled={saving}
                          />
                        </div>

                        {isActive && config && (
                          <div className="pl-4 space-y-3 border-l-2 border-gray-200">
                            {/* Allow Stock Updates */}
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`stock-${warehouse.warehouse_id}`} className="text-sm">
                                Permitir atualização de estoque
                              </Label>
                              <Switch
                                id={`stock-${warehouse.warehouse_id}`}
                                checked={allowStockUpdates}
                                onCheckedChange={(checked) => updateStockUpdates(warehouse.warehouse_id, checked)}
                                disabled={saving}
                              />
                            </div>

                            {/* Sync Direction */}
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`direction-${warehouse.warehouse_id}`} className="text-sm">
                                Direção de sincronização
                              </Label>
                              <Select
                                value={syncDirection}
                                onValueChange={(value: any) => updateSyncDirection(warehouse.warehouse_id, value)}
                                disabled={saving}
                              >
                                <SelectTrigger id={`direction-${warehouse.warehouse_id}`} className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="read_only">Somente Leitura</SelectItem>
                                  <SelectItem value="write_only">Somente Escrita</SelectItem>
                                  <SelectItem value="bidirectional">Bidirecional</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Info */}
                            <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                              {syncDirection === 'read_only' && '📖 A plataforma apenas lê dados deste estoque'}
                              {syncDirection === 'write_only' && '✏️ A plataforma apenas escreve dados neste estoque'}
                              {syncDirection === 'bidirectional' && '🔄 A plataforma lê e escreve dados neste estoque'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
