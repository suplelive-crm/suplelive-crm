import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, ShoppingCart, DollarSign, MessageSquare, Zap, ArrowRight, BarChartHorizontal, Package, Activity } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCrmStore } from '@/store/crmStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  totalClients: number;
  totalOrders: number;
  totalRevenue: number;
  totalEvents: number;
  totalStockChanges: number;
  activeWarehouses: number;
  revenueGrowth: number;
  ordersGrowth: number;
}

export function DashboardPage() {
  const { stats, fetchStats } = useCrmStore();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalClients: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalEvents: 0,
    totalStockChanges: 0,
    activeWarehouses: 0,
    revenueGrowth: 0,
    ordersGrowth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) {
      fetchStats();
      loadDashboardStats();
    }
  }, [fetchStats, currentWorkspace]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      // 1. Total de clientes
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace!.id);

      // 2. Total de pedidos
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace!.id);

      // 3. Receita total
      const { data: ordersData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('workspace_id', currentWorkspace!.id);

      const totalRevenue = ordersData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

      // 4. Eventos processados (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: eventsCount } = await supabase
        .from('event_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // 5. Alterações de estoque (últimos 30 dias)
      const { count: stockChangesCount } = await supabase
        .from('stock_change_log')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace!.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // 6. Warehouses ativos
      const { count: warehousesCount } = await supabase
        .from('baselinker_warehouses')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace!.id)
        .eq('is_active', true);

      // 7. Crescimento de receita (comparar últimos 30 dias com 30 dias anteriores)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data: recentOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('workspace_id', currentWorkspace!.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { data: previousOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('workspace_id', currentWorkspace!.id)
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      const recentRevenue = recentOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const previousRevenue = previousOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const revenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      // 8. Crescimento de pedidos
      const ordersGrowth = (previousOrders?.length || 0) > 0
        ? (((recentOrders?.length || 0) - (previousOrders?.length || 0)) / (previousOrders?.length || 0)) * 100
        : 0;

      setDashboardStats({
        totalClients: clientsCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
        totalEvents: eventsCount || 0,
        totalStockChanges: stockChangesCount || 0,
        activeWarehouses: warehousesCount || 0,
        revenueGrowth: Math.round(revenueGrowth),
        ordersGrowth: Math.round(ordersGrowth),
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsData = [
    {
      title: 'Total de Clientes',
      value: loading ? '...' : dashboardStats.totalClients,
      icon: Users,
      trend: null,
      valueClassName: 'text-indigo-600',
      iconClassName: 'bg-indigo-50'
    },
    {
      title: 'Total de Pedidos',
      value: loading ? '...' : dashboardStats.totalOrders,
      icon: ShoppingCart,
      trend: dashboardStats.ordersGrowth !== 0 ? {
        value: Math.abs(dashboardStats.ordersGrowth),
        isPositive: dashboardStats.ordersGrowth > 0
      } : null,
      valueClassName: 'text-purple-600',
      iconClassName: 'bg-purple-50'
    },
    {
      title: 'Receita Total',
      value: loading ? '...' : `R$ ${dashboardStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: dashboardStats.revenueGrowth !== 0 ? {
        value: Math.abs(dashboardStats.revenueGrowth),
        isPositive: dashboardStats.revenueGrowth > 0
      } : null,
      valueClassName: 'text-emerald-600',
      iconClassName: 'bg-emerald-50'
    },
    {
      title: 'Eventos (30 dias)',
      value: loading ? '...' : dashboardStats.totalEvents,
      icon: Activity,
      trend: null,
      valueClassName: 'text-blue-600',
      iconClassName: 'bg-blue-50'
    },
    {
      title: 'Alterações Estoque (30d)',
      value: loading ? '...' : dashboardStats.totalStockChanges,
      icon: Package,
      trend: null,
      valueClassName: 'text-amber-600',
      iconClassName: 'bg-amber-50'
    },
    {
      title: 'Warehouses Ativos',
      value: loading ? '...' : dashboardStats.activeWarehouses,
      icon: Zap,
      trend: null,
      valueClassName: 'text-rose-600',
      iconClassName: 'bg-rose-50'
    },
  ];

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Bem-vindo de volta ao {currentWorkspace?.name || 'seu workspace'}! Aqui está o resumo do seu negócio.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/analytics')}>
                <BarChartHorizontal className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
              <Button onClick={() => navigate('/clients')}>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Lead
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
            {statsData.map((stat, index) => (
              <StatsCard 
                key={stat.title} 
                {...stat} 
                index={index} 
              />
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-none">
              <CardHeader>
                <CardTitle className="text-blue-800">Inbox</CardTitle>
                <CardDescription className="text-blue-700/70">
                  Gerencie suas conversas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-blue-700">
                  {stats.totalConversations || 0} conversas ativas
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 w-full justify-between" onClick={() => navigate('/inbox')}>
                  <span>Ir para Inbox</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-none">
              <CardHeader>
                <CardTitle className="text-purple-800">Kanban</CardTitle>
                <CardDescription className="text-purple-700/70">
                  Visualize seu pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-purple-700">
                  {stats.totalLeads || 0} leads em processamento
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="text-purple-700 hover:text-purple-800 hover:bg-purple-100 w-full justify-between" onClick={() => navigate('/kanban')}>
                  <span>Ir para Kanban</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-none">
              <CardHeader>
                <CardTitle className="text-emerald-800">Automação</CardTitle>
                <CardDescription className="text-emerald-700/70">
                  Configure fluxos automáticos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-emerald-700">
                  Otimize seus processos
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 w-full justify-between" onClick={() => navigate('/automation')}>
                  <span>Ir para Automação</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Charts and Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Receita ao Longo do Tempo</CardTitle>
                <CardDescription>Tendências mensais de receita</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart />
              </CardContent>
            </Card>
            
            <RecentActivity />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}