import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
// Adicionado o ícone ExternalLink
import { Search, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AddOrderDialog } from '@/components/orders/AddOrderDialog';
import { OrderDetailsDialog } from '@/components/orders/OrderDetailsDialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCrmStore } from '@/store/crmStore';
import { Order } from '@/types';

export function OrdersPage() {
  const { orders, fetchOrders } = useCrmStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  // State to manage sorting configuration { key: 'column_name', direction: 'ascending' | 'descending' }
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order || !order.client) return false;
      const matchesSearch = order.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            order.total_amount.toString().includes(searchTerm) ||
                            order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Sort the filtered orders based on the sortConfig state
  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Helper to access nested properties like 'client.name'
        const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  // Function to handle clicks on table headers for sorting
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    // If clicking the same column, toggle direction
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Helper function to render the sort icon
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="inline-block ml-1 h-4 w-4" /> : <ArrowDown className="inline-block ml-1 h-4 w-4" />;
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailsOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalRevenue = orders
    .filter(order => order.status === 'completed')
    .reduce((sum, order) => sum + order.total_amount, 0);

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
              <p className="text-gray-600 mt-2">Track customer orders and sales</p>
            </div>
            <AddOrderDialog />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'pending').length}</div>
                <div className="text-sm text-gray-600">Pending Orders</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'completed').length}</div>
                <div className="text-sm text-gray-600">Completed Orders</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">${totalRevenue.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Total Revenue</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">${orders.length > 0 ? (totalRevenue / orders.filter(o => o.status === 'completed').length || 1).toFixed(2) : '0.00'}</div>
                <div className="text-sm text-gray-600">Avg Order Value</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {['all', 'pending', 'completed', 'cancelled'].map((status) => (
                    <Button
                      key={status}
                      variant={statusFilter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Orders ({sortedOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => requestSort('order_id_base')} className="cursor-pointer hover:bg-gray-100">
                      Order ID{getSortIcon('order_id_base')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('client.name')} className="cursor-pointer hover:bg-gray-100">
                      Client{getSortIcon('client.name')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('total_amount')} className="cursor-pointer hover:bg-gray-100">
                      Amount{getSortIcon('total_amount')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:bg-gray-100">
                      Status{getSortIcon('status')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('order_date')} className="cursor-pointer hover:bg-gray-100">
                      Date{getSortIcon('order_date')}
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {/* --- MODIFICAÇÃO AQUI --- */}
                        {order.order_id_base ? (
                          <a
                            href={`https://panel-u.baselinker.com/orders.php#order:${order.order_id_base}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            #{order.order_id_base}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span>#{order.id.slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell>{order.client?.name || 'Unknown Client'}</TableCell>
                      <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(order.order_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewOrder(order)}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
        
        <OrderDetailsDialog
          open={orderDetailsOpen}
          onOpenChange={setOrderDetailsOpen}
          order={selectedOrder}
        />
      </div>
    </DashboardLayout>
  );
}