import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInventoryStore } from '@/store/inventoryStore';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Search, Loader2, TrendingUp, Warehouse } from 'lucide-react';

export function EstoquePage() {
  const {
    products,
    warehouses,
    loading,
    searchQuery,
    selectedWarehouse,
    loadProducts,
    getProductSummaries,
    setSearchQuery,
    setSelectedWarehouse,
  } = useInventoryStore();

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const productSummaries = getProductSummaries();

  // Calculate total stock across all warehouses
  const totalStock = productSummaries.reduce((sum, p) => sum + p.totalStock, 0);

  // Calculate total stock value (using avg price)
  const totalValue = productSummaries.reduce((sum, p) => {
    return sum + (p.avgPrice || 0) * p.totalStock;
  }, 0);

  // Get unique warehouses from products
  const uniqueWarehouses = Array.from(warehouses.entries()).map(([id, info]) => ({
    id,
    ...info,
  }));

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">
            Gerencie o estoque de produtos em múltiplos armazéns
          </p>
        </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productSummaries.length}</div>
            <p className="text-xs text-muted-foreground">SKUs únicos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-muted-foreground">Unidades totais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Valor em estoque</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Pesquise e filtre produtos no estoque</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por SKU, nome ou EAN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={selectedWarehouse || 'all'}
              onValueChange={(value) => setSelectedWarehouse(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os armazéns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os armazéns</SelectItem>
                {uniqueWarehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedWarehouse(null);
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos em Estoque</CardTitle>
          <CardDescription>
            {productSummaries.length} produto(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : productSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-center">Estoque Total</TableHead>
                    <TableHead>Armazéns</TableHead>
                    <TableHead className="text-right">Preço Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSummaries.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell className="font-mono font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{product.ean || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={product.totalStock > 0 ? 'default' : 'secondary'}>
                          {product.totalStock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {product.warehouses.map((wh) => (
                            <div key={`${product.sku}-${wh.warehouseID}`} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="min-w-[60px] justify-center">
                                {wh.warehouseName}
                              </Badge>
                              <span className="text-muted-foreground">
                                {wh.stock} un.
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {product.avgPrice
                          ? `R$ ${product.avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>
    </DashboardLayout>
  );
}
