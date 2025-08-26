import { useState, useEffect } from 'react';
// Adicionado o ícone ShoppingCart para a nova seção de produtos
import { Eye, Package, User, Calendar, CreditCard, MapPin, Phone, Mail, FileText, DollarSign, ShoppingCart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Order } from '@/types';

// Definindo uma interface para o produto dentro do metadata para maior segurança do código
interface ProductMetadata {
  sku_produto: string;
  nome_produto: string;
  receita_produto: number;
  quantidade_de_itens: number;
}

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

export function OrderDetailsDialog({ open, onOpenChange, order }: OrderDetailsDialogProps) {
  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'processing': return 'Processando';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const metadata = order.metadata || {};
  const baselinkerData = Array.isArray(metadata) ? (metadata[0]?.baselinker_data || {}) : (metadata.baselinker_data || {});

  // Verificação para garantir que metadata é um array antes de renderizar a tabela de produtos
  const isProductArray = (data: any): data is ProductMetadata[] => {
    return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'sku_produto' in data[0];
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Pedido #{order.order_id_base || order.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resumo do Pedido
                </span>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusText(order.status)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">ID do Pedido</h4>
                    <p className="text-lg font-semibold">#{order.order_id_base || order.id.slice(0, 8)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Data do Pedido</h4>
                    <p className="font-medium">{formatDate(order.order_date)}</p>
                  </div>
                  {order.external_id && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">ID Externo</h4>
                      <p className="font-medium">{order.external_id}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Valor Total</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(order.total_amount)}
                    </p>
                  </div>
                  {order.canal_venda && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Canal de Venda</h4>
                      <p className="font-medium">{order.canal_venda}</p>
                    </div>
                  )}
                  {order.taxas && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Taxas</h4>
                      <p className="font-medium text-red-600">{formatCurrency(order.taxas)}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {order.faturamento_liquido && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Faturamento Líquido</h4>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatCurrency(order.faturamento_liquido)}
                      </p>
                    </div>
                  )}
                  {order.id_anuncio && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">ID do Anúncio</h4>
                      <p className="font-medium">{order.id_anuncio}</p>
                    </div>
                  )}
                  {order.conta && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Conta</h4>
                      <p className="font-medium">{order.conta}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Produtos do Pedido (anteriormente Dados Técnicos) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Produtos do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isProductArray(metadata) ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">SKU</TableHead>
                        <TableHead>Nome do Produto</TableHead>
                        <TableHead className="text-center w-[80px]">Qtd.</TableHead>
                        <TableHead className="text-right w-[150px]">Valor Unitário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metadata.map((product, index) => (
                        <TableRow key={product.sku_produto || index}>
                          <TableCell className="font-mono text-xs">{product.sku_produto}</TableCell>
                          <TableCell className="font-medium">{product.nome_produto}</TableCell>
                          <TableCell className="text-center">{product.quantidade_de_itens}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.receita_produto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Os dados do produto não estão no formato esperado. Exibindo dados brutos:</p>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Information */}
          {order.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Nome</h4>
                      <p className="font-medium">{order.client.name}</p>
                    </div>
                    {order.client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{order.client.email}</span>
                      </div>
                    )}
                    {order.client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{order.client.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Cliente desde</h4>
                      <p className="font-medium">{formatDate(order.client.created_at)}</p>
                    </div>
                    {order.client.total_orders && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Total de Pedidos</h4>
                        <p className="font-medium">{order.client.total_orders}</p>
                      </div>
                    )}
                    {order.client.total_spent && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Total Gasto</h4>
                        <p className="font-medium text-green-600">{formatCurrency(order.client.total_spent)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Baselinker Data (if available) */}
          {baselinkerData && Object.keys(baselinkerData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Informações de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* O restante do código permanece o mesmo... */}
              </CardContent>
            </Card>
          )}

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Detalhes Financeiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* O restante do código permanece o mesmo... */}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}