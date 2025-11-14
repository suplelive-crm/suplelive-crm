import { useState, useEffect } from 'react';
// Adicionado o ícone ExternalLink
import { Eye, Package, User, Calendar, CreditCard, MapPin, Phone, Mail, FileText, DollarSign, ShoppingCart, ExternalLink } from 'lucide-react';
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

// Definindo uma interface para o produto do Baselinker
interface BaselinkerProduct {
  sku: string;
  name: string;
  price_brutto: number;
  quantity: number;
  ean?: string;
  weight?: number;
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
    if (typeof amount !== 'number') return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data indisponível';
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

  // Extrair produtos do baselinker_data.products
  const products: BaselinkerProduct[] = baselinkerData?.products || [];
  const hasProducts = products.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
            {/* --- MODIFICAÇÃO AQUI --- */}
            <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span>Detalhes do Pedido</span>
                {order.order_id_base ? (
                <a
                    href={`https://panel-u.baselinker.com/orders.php#order:${order.order_id_base}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                >
                    #{order.order_id_base}
                    <ExternalLink className="h-4 w-4" />
                </a>
                ) : (
                <span>#{order.id.slice(0, 8)}</span>
                )}
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

          {/* Produtos do Pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Produtos do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasProducts ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">SKU</TableHead>
                        <TableHead>Nome do Produto</TableHead>
                        <TableHead className="w-[120px]">EAN</TableHead>
                        <TableHead className="text-center w-[80px]">Qtd.</TableHead>
                        <TableHead className="text-right w-[120px]">Preço Unit.</TableHead>
                        <TableHead className="text-right w-[120px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product, index) => (
                        <TableRow key={product.sku || index}>
                          <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="font-mono text-xs">{product.ean || '-'}</TableCell>
                          <TableCell className="text-center">{product.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.price_brutto)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(product.price_brutto * product.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Nenhum produto encontrado neste pedido.</p>
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
                    {typeof order.client.total_orders !== 'undefined' && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Total de Pedidos</h4>
                        <p className="font-medium">{order.client.total_orders}</p>
                      </div>
                    )}
                    {typeof order.client.total_spent !== 'undefined' && (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {baselinkerData.delivery_fullname && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Nome para Entrega</h4>
                          <p className="font-medium">{baselinkerData.delivery_fullname}</p>
                        </div>
                      )}
                      {baselinkerData.delivery_address && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Endereço</h4>
                          <p className="font-medium">{baselinkerData.delivery_address}</p>
                        </div>
                      )}
                      {baselinkerData.delivery_city && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Cidade</h4>
                          <p className="font-medium">
                            {baselinkerData.delivery_city}
                            {baselinkerData.delivery_postcode && ` - ${baselinkerData.delivery_postcode}`}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      {baselinkerData.invoice_company && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Empresa</h4>
                          <p className="font-medium">{baselinkerData.invoice_company}</p>
                        </div>
                      )}
                      {baselinkerData.delivery_country && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">País</h4>
                          <p className="font-medium">{baselinkerData.delivery_country}</p>
                        </div>
                      )}
                      {baselinkerData.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{baselinkerData.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 mb-1">Valor Total</h4>
                      <p className="text-xl font-bold text-blue-600">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </div>

                    {order.taxas && (
                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-red-800 mb-1">Taxas</h4>
                        <p className="text-xl font-bold text-red-600">
                          {formatCurrency(order.taxas)}
                        </p>
                      </div>
                    )}

                    {order.faturamento_liquido && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-green-800 mb-1">Faturamento Líquido</h4>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(order.faturamento_liquido)}
                        </p>
                      </div>
                    )}

                    {order['custo_frete(taxa)'] && (
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-orange-800 mb-1">Custo do Frete</h4>
                        <p className="text-xl font-bold text-orange-600">
                          {formatCurrency(order['custo_frete(taxa)'])}
                        </p>
                      </div>
                    )}
                  </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}