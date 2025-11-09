import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  ShoppingCart,
  MessageSquare,
  CheckCircle,
  Clock,
  Package,
  TrendingUp,
  TrendingDown,
  Truck,
  ArrowLeftRight,
  Loader2
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Activity {
  id: string;
  type: 'pedido' | 'estoque' | 'transferencia' | 'compra' | 'evento' | 'mensagem';
  user?: string;
  action: string;
  target: string;
  time: string;
  icon: any;
  metadata?: any;
  warehouse?: string;
  warehouseOrigin?: string;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getBadgeVariant = (type: string) => {
  switch (type) {
    case 'pedido': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'estoque': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'transferencia': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'compra': return 'bg-green-100 text-green-800 border-green-200';
    case 'evento': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'mensagem': return 'bg-pink-100 text-pink-800 border-pink-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function RecentActivity() {
  const { currentWorkspace } = useWorkspaceStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadActivities();
    }
  }, [currentWorkspace?.id]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const allActivities: Activity[] = [];

      // 1. Buscar pedidos recentes
      // NOTE: Orders doesn't have workspace_id, filter through clients
      // NOTE: Orders uses 'order_date' instead of 'created_at'
      const { data: orders } = await supabase
        .from('orders')
        .select('*, clients!inner(name, workspace_id)')
        .eq('clients.workspace_id', currentWorkspace!.id)
        .order('order_date', { ascending: false })
        .limit(10);

      if (orders) {
        orders.forEach(order => {
          const statusMap: Record<string, string> = {
            'pending': 'Pedido pendente',
            'paid': 'Pedido pago',
            'processing': 'Pedido em processamento',
            'shipped': 'Pedido enviado',
            'delivered': 'Pedido entregue',
            'cancelled': 'Pedido cancelado'
          };

          allActivities.push({
            id: `order-${order.id}`,
            type: 'pedido',
            user: order.clients?.name || 'Cliente',
            action: statusMap[order.status] || 'Novo pedido',
            target: `R$ ${order.total_amount?.toFixed(2) || '0,00'}`,
            time: formatDistanceToNow(new Date(order.order_date), { addSuffix: true, locale: ptBR }),
            icon: ShoppingCart,
            metadata: order,
          });
        });
      }

      // 2. Buscar compras recentes e agrupar por dia_lancado
      const { data: purchases } = await supabase
        .from('log_lançamento_estoque')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .eq('status', 'success')
        .order('dia_lancado', { ascending: false })
        .limit(20);

      if (purchases) {
        // Agrupar compras pela mesma dia_lancado (mesmo evento)
        const purchaseGroups = new Map<string, any[]>();
        purchases.forEach(purchase => {
          const key = `${purchase.dia_lancado}-${purchase.estoque_origem}`;
          if (!purchaseGroups.has(key)) {
            purchaseGroups.set(key, []);
          }
          purchaseGroups.get(key)!.push(purchase);
        });

        // Criar uma atividade por grupo
        purchaseGroups.forEach((group, key) => {
          const firstPurchase = group[0];
          const items = group.map(p => `${p.sku} (${p.quantidade})`).join(', ');

          allActivities.push({
            id: `purchase-${key}`,
            type: 'compra',
            user: 'Sistema',
            action: 'Compra recebida',
            target: items,
            time: formatDistanceToNow(new Date(firstPurchase.dia_lancado), { addSuffix: true, locale: ptBR }),
            icon: Package,
            warehouse: firstPurchase.estoque_origem,
            metadata: { group, count: group.length },
          });
        });
      }

      // 3. Buscar transferências recentes e agrupar por dia_lancado
      const { data: transfers } = await supabase
        .from('log_lançamento_transferencia')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .eq('status', 'success')
        .order('dia_lancado', { ascending: false })
        .limit(20);

      if (transfers) {
        // Agrupar transferências pela mesma dia_lancado (mesmo evento)
        const transferGroups = new Map<string, any[]>();
        transfers.forEach(transfer => {
          const key = `${transfer.dia_lancado}-${transfer.estoque_origem}-${transfer.estoque_destino}`;
          if (!transferGroups.has(key)) {
            transferGroups.set(key, []);
          }
          transferGroups.get(key)!.push(transfer);
        });

        // Criar uma atividade por grupo
        transferGroups.forEach((group, key) => {
          const firstTransfer = group[0];
          const items = group.map(t => `${t.sku} (${t.quantidade})`).join(', ');

          allActivities.push({
            id: `transfer-${key}`,
            type: 'transferencia',
            user: 'Sistema',
            action: 'Transferência',
            target: items,
            time: formatDistanceToNow(new Date(firstTransfer.dia_lancado), { addSuffix: true, locale: ptBR }),
            icon: ArrowLeftRight,
            warehouse: firstTransfer.estoque_destino,
            warehouseOrigin: firstTransfer.estoque_origem,
            metadata: { group, count: group.length },
          });
        });
      }

      // Ordenar todas as atividades por tempo (mais recentes primeiro)
      allActivities.sort((a, b) => {
        const getTime = (activity: Activity) => {
          // Orders use order_date
          if (activity.metadata?.order_date) return new Date(activity.metadata.order_date).getTime();
          if (activity.metadata?.created_at) return new Date(activity.metadata.created_at).getTime();
          if (activity.metadata?.dia_lancado) return new Date(activity.metadata.dia_lancado).getTime();
          if (activity.metadata?.group?.[0]?.dia_lancado) return new Date(activity.metadata.group[0].dia_lancado).getTime();
          if (activity.metadata?.processed_at) return new Date(activity.metadata.processed_at).getTime();
          return 0;
        };
        return getTime(b) - getTime(a);
      });

      // Pegar apenas as 15 mais recentes
      setActivities(allActivities.slice(0, 15));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Últimas ações no sistema</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Últimas ações no sistema</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <p>Nenhuma atividade recente</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Atividade Recente</CardTitle>
        <CardDescription>Últimas ações no sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {activities.map((activity) => {
          const Icon = activity.icon;
          return (
            <div key={activity.id} className="flex items-start space-x-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(activity.user || 'S')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <p className="text-sm font-medium leading-none">
                    {activity.user || 'Sistema'}
                  </p>
                  <Badge className={`${getBadgeVariant(activity.type)}`}>
                    <Icon className="h-3 w-3 mr-1" />
                    <span className="text-xs capitalize">{activity.type}</span>
                  </Badge>
                  {activity.warehouse && (
                    <Badge variant="outline" className="text-xs">
                      {activity.warehouseOrigin && `${activity.warehouseOrigin} → `}
                      {activity.warehouse}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.action} <span className="font-medium">{activity.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
