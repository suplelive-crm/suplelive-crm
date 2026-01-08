import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp, Package, DollarSign, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { supabase } from '@/lib/supabase';
import { ErrorHandler } from '@/lib/error-handler';

interface SkuSalesData {
  sku: string;
  nome_produto: string;
  quantidade_total: number;
  receita_bruta: number;
  faturamento_liquido: number;
  taxas_total: number;
  custo_medio: number;
  margem_liquida: number;
  numero_pedidos: number;
}

export function SalesBySkuPage() {
  const currentWorkspace = useWorkspaceStore(state => state.currentWorkspace);
  const [salesData, setSalesData] = useState<SkuSalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchSalesData = async () => {
    if (!currentWorkspace) return;

    await ErrorHandler.handleAsync(async () => {
      setLoading(true);

      // Buscar dados de orders_products com filtro de data
      const { data: ordersProducts, error } = await supabase
        .from('orders_products')
        .select(`
          sku,
          nome_produto,
          quantidade_produtos,
          receita_bruta,
          faturamento_liquido,
          taxas_produto,
          custo_medio_produto,
          order_id,
          created_at
        `)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .not('sku', 'is', null);

      if (error) throw error;

      // Agrupar por SKU
      const groupedData = (ordersProducts || []).reduce((acc, item) => {
        const sku = item.sku || 'SEM SKU';

        if (!acc[sku]) {
          acc[sku] = {
            sku,
            nome_produto: item.nome_produto || 'Produto sem nome',
            quantidade_total: 0,
            receita_bruta: 0,
            faturamento_liquido: 0,
            taxas_total: 0,
            custo_medio: item.custo_medio_produto || 0,
            margem_liquida: 0,
            numero_pedidos: new Set(),
          };
        }

        acc[sku].quantidade_total += Number(item.quantidade_produtos) || 0;
        acc[sku].receita_bruta += Number(item.receita_bruta) || 0;
        acc[sku].faturamento_liquido += Number(item.faturamento_liquido) || 0;
        acc[sku].taxas_total += Number(item.taxas_produto) || 0;
        acc[sku].numero_pedidos.add(item.order_id);

        return acc;
      }, {} as Record<string, any>);

      // Converter para array e calcular margem líquida
      const salesArray: SkuSalesData[] = Object.values(groupedData).map((item: any) => {
        const custoTotal = item.custo_medio * item.quantidade_total;
        const margemLiquida = item.faturamento_liquido - custoTotal;

        return {
          ...item,
          numero_pedidos: item.numero_pedidos.size,
          margem_liquida: margemLiquida,
        };
      });

      // Ordenar por quantidade vendida (maior para menor)
      salesArray.sort((a, b) => b.quantidade_total - a.quantidade_total);

      setSalesData(salesArray);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchSalesData();
  }, [currentWorkspace]);

  const totalStats = useMemo(() => {
    return salesData.reduce(
      (acc, item) => ({
        quantidade_total: acc.quantidade_total + item.quantidade_total,
        receita_bruta: acc.receita_bruta + item.receita_bruta,
        faturamento_liquido: acc.faturamento_liquido + item.faturamento_liquido,
        margem_liquida: acc.margem_liquida + item.margem_liquida,
      }),
      { quantidade_total: 0, receita_bruta: 0, faturamento_liquido: 0, margem_liquida: 0 }
    );
  }, [salesData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  const exportToCSV = () => {
    const headers = [
      'SKU',
      'Produto',
      'Quantidade Vendida',
      'Número de Pedidos',
      'Receita Bruta',
      'Faturamento Líquido',
      'Taxas',
      'Custo Médio Unit.',
      'Margem Líquida',
    ];

    const rows = salesData.map(item => [
      item.sku,
      item.nome_produto,
      item.quantidade_total,
      item.numero_pedidos,
      item.receita_bruta.toFixed(2),
      item.faturamento_liquido.toFixed(2),
      item.taxas_total.toFixed(2),
      item.custo_medio.toFixed(2),
      item.margem_liquida.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `vendas-por-sku-${startDate}-${endDate}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    ErrorHandler.showSuccess('Relatório exportado com sucesso!');
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vendas por SKU</h1>
              <p className="text-gray-600 mt-2">Análise detalhada de vendas por produto</p>
            </div>
            <Button onClick={exportToCSV} disabled={salesData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Período de Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="startDate">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <Button onClick={fetchSalesData} disabled={loading}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {loading ? 'Carregando...' : 'Consultar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{totalStats.quantidade_total}</div>
                    <div className="text-sm text-gray-600">Unidades Vendidas</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalStats.receita_bruta)}</div>
                    <div className="text-sm text-gray-600">Receita Bruta</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalStats.faturamento_liquido)}</div>
                    <div className="text-sm text-gray-600">Faturamento Líquido</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalStats.margem_liquida)}</div>
                    <div className="text-sm text-gray-600">Margem Líquida</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vendas Detalhadas por SKU ({salesData.length} produtos)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd. Vendida</TableHead>
                      <TableHead className="text-right">Nº Pedidos</TableHead>
                      <TableHead className="text-right">Receita Bruta</TableHead>
                      <TableHead className="text-right">Faturamento Líquido</TableHead>
                      <TableHead className="text-right">Taxas</TableHead>
                      <TableHead className="text-right">Custo Médio Unit.</TableHead>
                      <TableHead className="text-right">Margem Líquida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          Carregando dados...
                        </TableCell>
                      </TableRow>
                    ) : salesData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          Nenhum dado encontrado para o período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesData.map((item) => (
                        <TableRow key={item.sku}>
                          <TableCell className="font-medium">{item.sku}</TableCell>
                          <TableCell>{item.nome_produto}</TableCell>
                          <TableCell className="text-right">{item.quantidade_total}</TableCell>
                          <TableCell className="text-right">{item.numero_pedidos}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.receita_bruta)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.faturamento_liquido)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.taxas_total)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.custo_medio)}</TableCell>
                          <TableCell className={`text-right font-semibold ${item.margem_liquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(item.margem_liquida)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
