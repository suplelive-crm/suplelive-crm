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
  type: 'order' | 'stock_change' | 'transfer' | 'purchase' | 'event' | 'message';
  user?: string;
  action: string;
  target: string;
  time: string;
  icon: any;
  metadata?: any;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getBadgeVariant = (type: string) => {
  switch (type) {
    case 'order': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'stock_change': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'transfer': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'purchase': return 'bg-green-100 text-green-800 border-green-200';
    case 'event': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'message': return 'bg-pink-100 text-pink-800 border-pink-200';
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
      const { data: orders } = await supabase
        .from('orders')
        .select('*, clients(name)')
        .eq('workspace_id', currentWorkspace!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (orders) {
        orders.forEach(order => {
          allActivities.push({
            id: `order-${order.id}`,
            type: 'order',
            user: order.clients?.name || 'Cliente',
            action: 'Novo pedido criado',
            target: `R$ ${order.total_amount?.toFixed(2) || '0,00'}`,
            time: formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ptBR }),
            icon: ShoppingCart,
            metadata: order,
          });
        });
      }

      // 2. Buscar alterações de estoque recentes
      const { data: stockChanges } = await supabase
        .from('stock_change_log')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (stockChanges) {
        stockChanges.forEach(change => {
          const icon = change.quantity_change > 0 ? TrendingUp : TrendingDown;
          const actionText = change.quantity_change > 0 ? 'Adicionou' : 'Removeu';

          allActivities.push({
            id: `stock-${change.id}`,
            type: 'stock_change',
            user: change.user_name || 'Sistema',
            action: `${actionText} ${Math.abs(change.quantity_change)} unidades`,
            target: change.product_name || change.sku,
            time: formatDistanceToNow(new Date(change.created_at), { addSuffix: true, locale: ptBR }),
            icon,
            metadata: change,
          });
        });
      }

      // 3. Buscar transferências recentes
      const { data: transfers } = await supabase
        .from('log_lançamento_transferencia')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .order('dia_lancado', { ascending: false })
        .limit(5);

      if (transfers) {
        transfers.forEach(transfer => {
          allActivities.push({
            id: `transfer-${transfer.id}`,
            type: 'transfer',
            user: transfer.user_name || 'Sistema',
            action: 'Transferência de estoque',
            target: `${transfer.sku} (${transfer.quantidade})`,
            time: formatDistanceToNow(new Date(transfer.dia_lancado), { addSuffix: true, locale: ptBR }),
            icon: ArrowLeftRight,
            metadata: transfer,
          });
        });
      }

      // 4. Buscar eventos recentes (event_queue)
      const { data: events } = await supabase
        .from('event_queue')
        .select('*')
        .eq('status', 'completed')
        .order('processed_at', { ascending: false })
        .limit(5);

      if (events) {
        events.forEach(event => {
          allActivities.push({
            id: `event-${event.id}`,
            type: 'event',
            user: 'Sistema',
            action: event.event_name.replace(/_/g, ' '),
            target: event.order_id ? `Pedido #${event.order_id}` : 'Processado',
            time: formatDistanceToNow(new Date(event.processed_at || event.created_at), { addSuffix: true, locale: ptBR }),
            icon: CheckCircle,
            metadata: event,
          });
        });
      }

      // 5. Buscar compras recentes
      const { data: purchases } = await supabase
        .from('log_lançamento_estoque')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .order('dia_lancado', { ascending: false })
        .limit(5);

      if (purchases) {
        purchases.forEach(purchase => {
          allActivities.push({
            id: `purchase-${purchase.id}`,
            type: 'purchase',
            user: purchase.user_name || 'Sistema',
            action: 'Compra recebida',
            target: `${purchase.sku} (${purchase.quantidade})`,
            time: formatDistanceToNow(new Date(purchase.dia_lancado), { addSuffix: true, locale: ptBR }),
            icon: Package,
            metadata: purchase,
          });
        });
      }

      // Ordenar todas as atividades por tempo (mais recentes primeiro)
      allActivities.sort((a, b) => {
        const timeA = a.metadata?.created_at || a.metadata?.dia_lancado || a.metadata?.processed_at;
        const timeB = b.metadata?.created_at || b.metadata?.dia_lancado || b.metadata?.processed_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      // Pegar apenas as 10 mais recentes
      setActivities(allActivities.slice(0, 10));
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
                <div className="flex items-center">
                  <p className="text-sm font-medium leading-none">
                    {activity.user || 'Sistema'}
                  </p>
                  <Badge className={`ml-2 ${getBadgeVariant(activity.type)}`}>
                    <Icon className="h-3 w-3 mr-1" />
                    <span className="text-xs">{activity.type}</span>
                  </Badge>
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
