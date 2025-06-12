import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, ShoppingCart, DollarSign, MessageSquare, Zap, ArrowRight, BarChartHorizontal } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCrmStore } from '@/store/crmStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { stats, fetchStats } = useCrmStore();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentWorkspace) {
      fetchStats();
    }
  }, [fetchStats, currentWorkspace]);

  const statsData = [
    {
      title: 'Total de Leads',
      value: stats.totalLeads || 0,
      icon: UserPlus,
      trend: { value: 12, isPositive: true },
      valueClassName: 'text-blue-600',
      iconClassName: 'bg-blue-50'
    },
    {
      title: 'Total de Clientes',
      value: stats.totalClients || 0,
      icon: Users,
      trend: { value: 8, isPositive: true },
      valueClassName: 'text-indigo-600',
      iconClassName: 'bg-indigo-50'
    },
    {
      title: 'Total de Pedidos',
      value: stats.totalOrders || 0,
      icon: ShoppingCart,
      trend: { value: 15, isPositive: true },
      valueClassName: 'text-purple-600',
      iconClassName: 'bg-purple-50'
    },
    {
      title: 'Receita Total',
      value: `R$ ${stats.totalRevenue?.toLocaleString() || '0'}`,
      icon: DollarSign,
      trend: { value: 23, isPositive: true },
      valueClassName: 'text-emerald-600',
      iconClassName: 'bg-emerald-50'
    },
    {
      title: 'Conversas',
      value: stats.totalConversations || 0,
      icon: MessageSquare,
      trend: { value: 5, isPositive: true },
      valueClassName: 'text-amber-600',
      iconClassName: 'bg-amber-50'
    },
    {
      title: 'Canais Ativos',
      value: stats.activeChannels || 0,
      icon: Zap,
      trend: { value: 2, isPositive: true },
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