import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, DollarSign, MessageSquare, Target } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCrmStore } from '@/store/crmStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export function AnalyticsPage() {
  const { stats, leads, clients, orders, messages, fetchStats, fetchLeads, fetchClients, fetchOrders, fetchMessages } = useCrmStore();
  const { currentWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (currentWorkspace) {
      fetchStats();
      fetchLeads();
      fetchClients();
      fetchOrders();
      fetchMessages();
    }
  }, [currentWorkspace, fetchStats, fetchLeads, fetchClients, fetchOrders, fetchMessages]);

  // Mock data for charts - in a real app, this would come from analytics API
  const revenueData = [
    { month: 'Jan', revenue: 4000, orders: 24 },
    { month: 'Feb', revenue: 3000, orders: 18 },
    { month: 'Mar', revenue: 5000, orders: 32 },
    { month: 'Apr', revenue: 4500, orders: 28 },
    { month: 'May', revenue: 6000, orders: 38 },
    { month: 'Jun', revenue: 5500, orders: 35 },
  ];

  const leadSourceData = [
    { name: 'Website', value: 35, color: '#3b82f6' },
    { name: 'Social Media', value: 25, color: '#10b981' },
    { name: 'Referral', value: 20, color: '#f59e0b' },
    { name: 'Advertising', value: 15, color: '#ef4444' },
    { name: 'Other', value: 5, color: '#8b5cf6' },
  ];

  const conversionFunnelData = [
    { stage: 'Leads', count: leads.length, percentage: 100 },
    { stage: 'Contacted', count: leads.filter(l => l.status === 'contacted').length, percentage: 0 },
    { stage: 'Qualified', count: leads.filter(l => l.status === 'qualified').length, percentage: 0 },
    { stage: 'Converted', count: leads.filter(l => l.status === 'converted').length, percentage: 0 },
  ].map((item, index, array) => ({
    ...item,
    percentage: array[0].count > 0 ? Math.round((item.count / array[0].count) * 100) : 0
  }));

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-2">Insights and performance metrics for your business</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {stats.conversionRate ? `${stats.conversionRate.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ${stats.avgOrderValue ? stats.avgOrderValue.toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Clients</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.activeClients || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Messages Sent</p>
                    <p className="text-2xl font-bold text-orange-600">{messages.length}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="revenue" className="space-y-6">
            <TabsList>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="leads">Lead Sources</TabsTrigger>
              <TabsTrigger value="conversion">Conversion Funnel</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Over Time</CardTitle>
                  <CardDescription>Monthly revenue and order trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} />
                      <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leads" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Lead Sources</CardTitle>
                    <CardDescription>Distribution of lead sources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={leadSourceData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {leadSourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Lead Source Performance</CardTitle>
                    <CardDescription>Leads by source this month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {leadSourceData.map((source) => (
                        <div key={source.name} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: source.color }}
                            />
                            <span className="text-sm font-medium">{source.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">{source.value}%</span>
                            <Badge variant="outline">{Math.round(leads.length * source.value / 100)} leads</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="conversion" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                  <CardDescription>Lead to client conversion process</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {conversionFunnelData.map((stage, index) => (
                      <div key={stage.stage} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{stage.stage}</span>
                          <span className="text-sm text-gray-600">
                            {stage.count} ({stage.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${stage.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Performance</CardTitle>
                    <CardDescription>Key metrics comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="orders" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Insights</CardTitle>
                    <CardDescription>Key observations and recommendations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Strong Performance</h4>
                        <p className="text-sm text-green-700">
                          Revenue has increased by 23% compared to last month
                        </p>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Opportunity</h4>
                        <p className="text-sm text-yellow-700">
                          Lead conversion rate could be improved with better follow-up
                        </p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Recommendation</h4>
                        <p className="text-sm text-blue-700">
                          Focus on social media leads as they show highest conversion
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}