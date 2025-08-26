import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
// Assuming these are your actual component paths
// import { DashboardLayout } from '@/components/layout/DashboardLayout';
// import { AddOrderDialog } from '@/components/orders/AddOrderDialog';
// import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// import { useCrmStore } from '@/store/crmStore';

// Mock components for demonstration purposes
const MockComponent = ({ children, ...props }) => <div {...props}>{children}</div>;
const DashboardLayout = ({ children }) => <div className="p-4 bg-gray-50 min-h-screen font-sans">{children}</div>;
const AddOrderDialog = () => <Button>Add New Order</Button>;
const Input = (props) => <input {...props} className={`w-full p-2 border rounded-md ${props.className}`} />;
const Badge = ({ children, className }) => <span className={`px-2 py-1 text-xs font-semibold rounded-full ${className}`}>{children}</span>;
const Button = ({ children, variant = 'default', size = 'md', ...props }) => {
    const baseStyle = "px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2";
    const variantStyles = {
        default: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    };
    return <button className={`${baseStyle} ${variantStyles[variant]}`} {...props}>{children}</button>;
};
const Card = ({ children }) => <div className="bg-white rounded-lg shadow-sm border">{children}</div>;
const CardHeader = ({ children }) => <div className="p-4 border-b">{children}</div>;
const CardTitle = ({ children }) => <h3 className="text-lg font-semibold text-gray-800">{children}</h3>;
const CardContent = ({ children }) => <div className="p-4">{children}</div>;
const Table = ({ children }) => <table className="w-full text-sm text-left text-gray-500">{children}</table>;
const TableHeader = ({ children }) => <thead className="text-xs text-gray-700 uppercase bg-gray-50">{children}</thead>;
const TableHead = ({ children, ...props }) => <th scope="col" className="px-6 py-3" {...props}>{children}</th>;
const TableBody = ({ children }) => <tbody>{children}</tbody>;
const TableRow = ({ children }) => <tr className="bg-white border-b hover:bg-gray-50">{children}</tr>;
const TableCell = ({ children, ...props }) => <td className="px-6 py-4" {...props}>{children}</td>;

// Mock store for demonstration
const useCrmStore = () => {
    const [orders, setOrders] = useState([]);
    const fetchOrders = () => {
        // Mock data
        const mockOrders = [
            { id: 'ORD-2024-001', client: { name: 'John Doe' }, total_amount: 150.75, status: 'completed', order_date: '2024-07-29T10:00:00Z' },
            { id: 'ORD-2024-002', client: { name: 'Jane Smith' }, total_amount: 200.00, status: 'pending', order_date: '2024-07-30T11:30:00Z' },
            { id: 'ORD-2024-003', client: { name: 'Alice Johnson' }, total_amount: 75.50, status: 'completed', order_date: '2024-07-28T14:00:00Z' },
            { id: 'ORD-2024-004', client: { name: 'Robert Brown' }, total_amount: 320.00, status: 'cancelled', order_date: '2024-07-25T09:00:00Z' },
            { id: 'ORD-2024-005', client: { name: 'Chris Green' }, total_amount: 50.25, status: 'pending', order_date: '2024-07-30T15:00:00Z' },
        ];
        setOrders(mockOrders);
    };
    return { orders, fetchOrders };
};


export default function App() {
  const { orders, fetchOrders } = useCrmStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // State to manage sorting configuration { key: 'column_name', direction: 'ascending' | 'descending' }
  const [sortConfig, setSortConfig] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders based on search and status filter
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
        const getNestedValue = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

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
  const requestSort = (key) => {
    let direction = 'ascending';
    // If clicking the same column, toggle direction
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Helper function to render the sort icon
  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusColor = (status) => {
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
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
                <div className="flex gap-2 flex-wrap">
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Make TableHead clickable to trigger sort */}
                      <TableHead onClick={() => requestSort('id')} className="cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">Order ID {getSortIcon('id')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('client.name')} className="cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">Client {getSortIcon('client.name')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('total_amount')} className="cursor-pointer hover:bg-gray-100 transition-colors">
                         <div className="flex items-center gap-2">Amount {getSortIcon('total_amount')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:bg-gray-100 transition-colors">
                         <div className="flex items-center gap-2">Status {getSortIcon('status')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('order_date')} className="cursor-pointer hover:bg-gray-100 transition-colors">
                         <div className="flex items-center gap-2">Date {getSortIcon('order_date')}</div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Map over the new 'sortedOrders' array */}
                    {sortedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-gray-900">
                          {order.id.slice(0, 12)}
                        </TableCell>
                        <TableCell>{order.client?.name || 'Unknown Client'}</TableCell>
                        <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
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
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
