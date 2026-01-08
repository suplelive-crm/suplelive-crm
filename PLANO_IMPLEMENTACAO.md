# 🎯 Plano de Implementação - Funcionalidades Faltantes

## 📋 Escopo do Projeto

Implementar 6 funcionalidades principais (excluindo "Visualização Loja/Cliente e Loja/Fornecedor"):

1. ✅ Configurar auto-confirmação de email
2. ✅ Adicionar verificação de role para deletar pedidos
3. ✅ Adicionar campo "verificado" em clientes
4. ✅ Implementar sistema de verificação de pedidos pendentes
5. ✅ Criar página de Vendas por SKU
6. ✅ Adicionar filtros categorizados no painel de mensagens

---

## 🔴 FASE 1 - Correções Críticas (Prioridade Alta)

### 1.1 Configurar Auto-Confirmação de Email ⚠️ CRÍTICO

**Objetivo**: Permitir que usuários criem conta sem precisar confirmar email (Netlify)

**Tempo Estimado**: 30 minutos

**Arquivos**:
- Configuração Supabase (Dashboard)
- Alternativamente: `src/store/authStore.ts`

**Passos**:

#### Opção A - Dashboard Supabase (RECOMENDADO)
1. Acessar: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. Authentication → Settings → Email Auth
3. Desmarcar "Enable email confirmations"
4. Salvar

#### Opção B - Modificar Código (Se Opção A não disponível)

**Arquivo**: `src/store/authStore.ts`

```typescript
signUp: async (email: string, password: string) => {
  try {
    set({ loading: true });

    // Usar Admin API para auto-confirmar
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true  // ✅ Auto-confirma
    });

    if (error) throw error;

    // Fazer login automático
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) throw signInError;

    ErrorHandler.showSuccess('Conta criada com sucesso!', 'Bem-vindo ao OmniCRM!');
  } catch (error) {
    ErrorHandler.showError(error);
    throw error;
  } finally {
    set({ loading: false });
  }
},
```

**Testes**:
- [ ] Criar nova conta
- [ ] Verificar se login é automático
- [ ] Verificar se não pede confirmação de email

---

### 1.2 Adicionar Verificação de Role para Deletar Pedidos 🔒 CRÍTICO

**Objetivo**: Apenas Admin e Proprietário podem deletar pedidos

**Tempo Estimado**: 1 hora

**Arquivos**:
- `src/store/crmStore.ts`
- `src/pages/OrdersPage.tsx`
- `src/store/workspaceStore.ts`

**Passos**:

#### 1.2.1 Adicionar helper para verificar role

**Arquivo**: `src/store/workspaceStore.ts`

```typescript
// Adicionar ao estado
interface WorkspaceState {
  // ... existing fields
  getCurrentUserRole: () => 'owner' | 'admin' | 'operator' | null;
  canDeleteOrders: () => boolean;
}

// Adicionar função
getCurrentUserRole: () => {
  const currentWorkspace = get().currentWorkspace;
  const user = useAuthStore.getState().user;

  if (!currentWorkspace || !user) return null;

  const userInWorkspace = currentWorkspace.workspace_users?.find(
    wu => wu.user_id === user.id
  );

  return userInWorkspace?.role || null;
},

canDeleteOrders: () => {
  const role = get().getCurrentUserRole();
  return role === 'owner' || role === 'admin';
},
```

#### 1.2.2 Atualizar função de deletar

**Arquivo**: `src/store/crmStore.ts`

```typescript
deleteOrder: async (orderId: string) => {
  try {
    // ✅ Verificar permissão
    const canDelete = useWorkspaceStore.getState().canDeleteOrders();

    if (!canDelete) {
      throw new Error('Apenas Administradores e Proprietários podem deletar pedidos');
    }

    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    if (!currentWorkspace) throw new Error('No workspace selected');

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
      .eq('workspace_id', currentWorkspace.id);

    if (error) throw error;

    set((state) => ({
      orders: state.orders.filter((o) => o.id !== orderId),
    }));

    ErrorHandler.showSuccess('Pedido deletado', 'O pedido foi removido com sucesso.');
  } catch (error) {
    ErrorHandler.showError(error);
    throw error;
  }
},

deleteOrders: async (orderIds: string[]) => {
  try {
    // ✅ Verificar permissão
    const canDelete = useWorkspaceStore.getState().canDeleteOrders();

    if (!canDelete) {
      throw new Error('Apenas Administradores e Proprietários podem deletar pedidos');
    }

    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    if (!currentWorkspace) throw new Error('No workspace selected');

    const { error } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds)
      .eq('workspace_id', currentWorkspace.id);

    if (error) throw error;

    set((state) => ({
      orders: state.orders.filter((o) => !orderIds.includes(o.id)),
    }));

    ErrorHandler.showSuccess(
      'Pedidos deletados',
      `${orderIds.length} pedido(s) removido(s) com sucesso.`
    );
  } catch (error) {
    ErrorHandler.showError(error);
    throw error;
  }
},
```

#### 1.2.3 Ocultar botão de deletar

**Arquivo**: `src/pages/OrdersPage.tsx`

```tsx
import { useWorkspaceStore } from '@/store/workspaceStore';

export function OrdersPage() {
  const canDeleteOrders = useWorkspaceStore(state => state.canDeleteOrders);

  // ... existing code

  return (
    // ... existing code

    {/* Botão de deletar - apenas para Admin/Owner */}
    {selectedOrders.length > 0 && canDeleteOrders() && (
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDeleteSelected}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Deletar Selecionados ({selectedOrders.length})
      </Button>
    )}
  );
}
```

**Testes**:
- [ ] Proprietário pode deletar
- [ ] Admin pode deletar
- [ ] Operador NÃO pode deletar (botão oculto)
- [ ] Operador NÃO pode deletar via API (erro)

---

### 1.3 Adicionar Campo "Verificado" em Clientes ✅

**Objetivo**: Marcar clientes como verificados

**Tempo Estimado**: 1.5 horas

**Arquivos**:
- `supabase/migrations/add_client_verification.sql` (criar)
- `src/types/index.ts`
- `src/pages/ClientsPage.tsx`
- `src/components/clients/CreateClientDialog.tsx`

**Passos**:

#### 1.3.1 Criar migration SQL

**Arquivo**: `supabase/migrations/add_client_verification.sql`

```sql
-- Adicionar campo is_verified na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_clients_is_verified ON clients(is_verified);

-- Comentário
COMMENT ON COLUMN clients.is_verified IS 'Indica se o cliente foi verificado manualmente';
```

#### 1.3.2 Atualizar types

**Arquivo**: `src/types/index.ts`

```typescript
export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  tags?: string[];
  source?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes?: string;
  external_id?: string;
  is_verified?: boolean;  // ✅ Novo campo
  created_at: string;
  updated_at: string;
}
```

#### 1.3.3 Adicionar badge na lista

**Arquivo**: `src/pages/ClientsPage.tsx`

```tsx
import { CheckCircle } from 'lucide-react';

// Na tabela de clientes
<TableCell>
  <div className="flex items-center gap-2">
    <span className="font-medium">{client.name}</span>
    {client.is_verified && (
      <Badge className="bg-green-100 text-green-800 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verificado
      </Badge>
    )}
  </div>
</TableCell>
```

#### 1.3.4 Adicionar toggle na modal de edição

**Arquivo**: `src/components/clients/CreateClientDialog.tsx`

```tsx
import { Checkbox } from '@/components/ui/checkbox';

// Adicionar estado
const [isVerified, setIsVerified] = useState(client?.is_verified || false);

// No formulário
<div className="flex items-center space-x-2">
  <Checkbox
    id="is_verified"
    checked={isVerified}
    onCheckedChange={(checked) => setIsVerified(checked as boolean)}
  />
  <Label
    htmlFor="is_verified"
    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
  >
    Cliente Verificado
  </Label>
</div>

// Ao salvar
const clientData = {
  // ... outros campos
  is_verified: isVerified,
};
```

#### 1.3.5 Adicionar filtro "Apenas Verificados"

**Arquivo**: `src/pages/ClientsPage.tsx`

```tsx
const [showOnlyVerified, setShowOnlyVerified] = useState(false);

// Filtrar clientes
const filteredClients = clients.filter(client => {
  // ... filtros existentes

  if (showOnlyVerified && !client.is_verified) {
    return false;
  }

  return true;
});

// No JSX
<div className="flex items-center gap-2">
  <Checkbox
    id="show-verified"
    checked={showOnlyVerified}
    onCheckedChange={(checked) => setShowOnlyVerified(checked as boolean)}
  />
  <Label htmlFor="show-verified">Apenas Verificados</Label>
</div>
```

**Testes**:
- [ ] Adicionar campo no banco
- [ ] Badge aparece para clientes verificados
- [ ] Checkbox funciona na modal de edição
- [ ] Filtro "Apenas Verificados" funciona

---

## 🟡 FASE 2 - Funcionalidades Principais (Prioridade Média)

### 2.1 Implementar Sistema de Verificação de Pedidos Pendentes 📋

**Objetivo**: Sistema de aprovação/verificação de pedidos

**Tempo Estimado**: 2 horas

**Arquivos**:
- `supabase/migrations/add_order_verification.sql` (criar)
- `src/types/index.ts`
- `src/pages/OrdersPage.tsx`
- `src/store/crmStore.ts`

**Passos**:

#### 2.1.1 Criar migration SQL

**Arquivo**: `supabase/migrations/add_order_verification.sql`

```sql
-- Adicionar campos de verificação
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Índices
CREATE INDEX IF NOT EXISTS idx_orders_is_verified ON orders(is_verified);
CREATE INDEX IF NOT EXISTS idx_orders_verified_by ON orders(verified_by);

-- Comentários
COMMENT ON COLUMN orders.is_verified IS 'Indica se o pedido foi verificado/aprovado por um administrador';
COMMENT ON COLUMN orders.verified_by IS 'Usuário que verificou o pedido';
COMMENT ON COLUMN orders.verified_at IS 'Data e hora da verificação';
```

#### 2.1.2 Atualizar types

**Arquivo**: `src/types/index.ts`

```typescript
export interface Order {
  // ... existing fields
  is_verified?: boolean;
  verified_by?: string;
  verified_at?: string;
}
```

#### 2.1.3 Adicionar função de verificação

**Arquivo**: `src/store/crmStore.ts`

```typescript
verifyOrder: async (orderId: string) => {
  try {
    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    const currentUser = useAuthStore.getState().user;

    if (!currentWorkspace || !currentUser) {
      throw new Error('No workspace or user');
    }

    // Verificar se usuário é Admin ou Owner
    const canVerify = useWorkspaceStore.getState().canDeleteOrders(); // Mesma permissão

    if (!canVerify) {
      throw new Error('Apenas Administradores podem verificar pedidos');
    }

    const { error } = await supabase
      .from('orders')
      .update({
        is_verified: true,
        verified_by: currentUser.id,
        verified_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('workspace_id', currentWorkspace.id);

    if (error) throw error;

    // Atualizar estado local
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? { ...o, is_verified: true, verified_by: currentUser.id, verified_at: new Date().toISOString() }
          : o
      ),
    }));

    ErrorHandler.showSuccess('Pedido verificado', 'O pedido foi aprovado com sucesso.');
  } catch (error) {
    ErrorHandler.showError(error);
    throw error;
  }
},

unverifyOrder: async (orderId: string) => {
  try {
    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;

    if (!currentWorkspace) {
      throw new Error('No workspace selected');
    }

    const canVerify = useWorkspaceStore.getState().canDeleteOrders();

    if (!canVerify) {
      throw new Error('Apenas Administradores podem desmarcar verificação');
    }

    const { error } = await supabase
      .from('orders')
      .update({
        is_verified: false,
        verified_by: null,
        verified_at: null
      })
      .eq('id', orderId)
      .eq('workspace_id', currentWorkspace.id);

    if (error) throw error;

    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? { ...o, is_verified: false, verified_by: null, verified_at: null }
          : o
      ),
    }));

    ErrorHandler.showSuccess('Verificação removida', 'A verificação foi removida.');
  } catch (error) {
    ErrorHandler.showError(error);
    throw error;
  }
},
```

#### 2.1.4 Adicionar UI de verificação

**Arquivo**: `src/pages/OrdersPage.tsx`

```tsx
import { CheckCircle, XCircle } from 'lucide-react';

// Adicionar filtro
const [showOnlyUnverified, setShowOnlyUnverified] = useState(false);

// Filtrar pedidos
const filteredOrders = orders.filter(order => {
  // ... filtros existentes

  if (showOnlyUnverified && order.is_verified) {
    return false;
  }

  return true;
});

// Na tabela
<TableCell>
  <div className="flex items-center gap-2">
    {order.is_verified ? (
      <Badge className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verificado
      </Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800">
        <XCircle className="h-3 w-3 mr-1" />
        Pendente Verificação
      </Badge>
    )}
  </div>
</TableCell>

// Botão de verificação (apenas Admin/Owner)
{canDeleteOrders() && (
  <DropdownMenuItem
    onClick={() => {
      if (order.is_verified) {
        unverifyOrder(order.id);
      } else {
        verifyOrder(order.id);
      }
    }}
  >
    {order.is_verified ? (
      <>
        <XCircle className="mr-2 h-4 w-4" />
        Remover Verificação
      </>
    ) : (
      <>
        <CheckCircle className="mr-2 h-4 w-4" />
        Verificar Pedido
      </>
    )}
  </DropdownMenuItem>
)}

// Filtro
<div className="flex items-center gap-2">
  <Checkbox
    id="show-unverified"
    checked={showOnlyUnverified}
    onCheckedChange={(checked) => setShowOnlyUnverified(checked as boolean)}
  />
  <Label htmlFor="show-unverified">Apenas Não Verificados</Label>
</div>

// Card de estatística
<Card>
  <CardContent className="p-4">
    <div className="text-2xl font-bold text-yellow-600">
      {orders.filter(o => !o.is_verified).length}
    </div>
    <div className="text-sm text-gray-600">Pendentes Verificação</div>
  </CardContent>
</Card>
```

**Testes**:
- [ ] Admin pode verificar pedido
- [ ] Badge aparece corretamente
- [ ] Filtro "Não Verificados" funciona
- [ ] Card de estatística atualiza

---

### 2.2 Criar Página de Vendas por SKU 📊

**Objetivo**: Relatório de vendas por produto com seletor de período

**Tempo Estimado**: 3 horas

**Arquivos**:
- `src/pages/SalesBySKUPage.tsx` (criar)
- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/sales/SalesTable.tsx` (criar)
- `src/components/sales/DateRangePicker.tsx` (criar)

**Passos**:

#### 2.2.1 Criar página principal

**Arquivo**: `src/pages/SalesBySKUPage.tsx`

```tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Calendar } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { supabase } from '@/lib/supabase';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SalesTable } from '@/components/sales/SalesTable';
import { DateRangePicker } from '@/components/sales/DateRangePicker';

interface SKUSalesData {
  sku: string;
  product_name: string;
  total_orders: number;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
}

export function SalesBySKUPage() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [salesData, setSalesData] = useState<SKUSalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentWorkspace } = useWorkspaceStore();

  const fetchSalesData = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      // Buscar produtos dos pedidos no período
      const { data: orderProducts, error } = await supabase
        .from('orders_products')
        .select(`
          sku,
          nome_produto,
          quantidade_produtos,
          preco_produto,
          orders!inner(
            id,
            order_date,
            workspace_id,
            status
          )
        `)
        .eq('orders.workspace_id', currentWorkspace.id)
        .gte('orders.order_date', format(startDate, 'yyyy-MM-dd'))
        .lte('orders.order_date', format(endDate, 'yyyy-MM-dd'))
        .neq('orders.status', 'cancelled');

      if (error) throw error;

      // Agrupar por SKU
      const grouped = orderProducts?.reduce((acc, item) => {
        const sku = item.sku || 'SEM_SKU';

        if (!acc[sku]) {
          acc[sku] = {
            sku,
            product_name: item.nome_produto || 'Produto sem nome',
            total_orders: 0,
            total_quantity: 0,
            total_revenue: 0,
            order_ids: new Set()
          };
        }

        acc[sku].order_ids.add(item.orders.id);
        acc[sku].total_quantity += item.quantidade_produtos || 0;
        acc[sku].total_revenue += (item.preco_produto || 0) * (item.quantidade_produtos || 0);

        return acc;
      }, {} as Record<string, any>);

      // Converter para array e calcular médias
      const salesArray: SKUSalesData[] = Object.values(grouped || {}).map((item: any) => ({
        sku: item.sku,
        product_name: item.product_name,
        total_orders: item.order_ids.size,
        total_quantity: item.total_quantity,
        total_revenue: item.total_revenue,
        avg_price: item.total_revenue / item.total_quantity
      }));

      // Ordenar por receita (maior primeiro)
      salesArray.sort((a, b) => b.total_revenue - a.total_revenue);

      setSalesData(salesArray);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [currentWorkspace, startDate, endDate]);

  const handleExportCSV = () => {
    // Criar CSV
    const headers = ['SKU', 'Produto', 'Pedidos', 'Quantidade', 'Receita Total', 'Preço Médio'];
    const rows = salesData.map(item => [
      item.sku,
      item.product_name,
      item.total_orders,
      item.total_quantity,
      item.total_revenue.toFixed(2),
      item.avg_price.toFixed(2)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-sku-${format(startDate, 'dd-MM-yyyy')}-${format(endDate, 'dd-MM-yyyy')}.csv`;
    a.click();
  };

  const totalRevenue = salesData.reduce((sum, item) => sum + item.total_revenue, 0);
  const totalQuantity = salesData.reduce((sum, item) => sum + item.total_quantity, 0);
  const totalProducts = salesData.length;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendas por SKU</h1>
            <p className="text-gray-600 mt-2">
              Análise detalhada de vendas por produto
            </p>
          </div>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Seletor de Período */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={fetchSalesData}
        />

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Receita Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Quantidade Vendida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalQuantity}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Produtos Diferentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {totalProducts}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Vendas */}
        <SalesTable data={salesData} loading={loading} />
      </motion.div>
    </DashboardLayout>
  );
}
```

#### 2.2.2 Criar componente DateRangePicker

**Arquivo**: `src/components/sales/DateRangePicker.tsx`

```tsx
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onApply: () => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply
}: DateRangePickerProps) {
  const presets = [
    { label: 'Hoje', days: 0 },
    { label: 'Últimos 7 dias', days: 7 },
    { label: 'Últimos 30 dias', days: 30 },
    { label: 'Últimos 90 dias', days: 90 },
  ];

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = days === 0 ? end : subDays(end, days);
    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Presets */}
          <div className="flex gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handlePreset(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && onStartDateChange(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-gray-500">até</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && onEndDateChange(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button onClick={onApply} size="sm">
              Aplicar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 2.2.3 Criar tabela de vendas

**Arquivo**: `src/components/sales/SalesTable.tsx`

```tsx
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface SKUSalesData {
  sku: string;
  product_name: string;
  total_orders: number;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
}

interface SalesTableProps {
  data: SKUSalesData[];
  loading: boolean;
}

export function SalesTable({ data, loading }: SalesTableProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-500">Nenhuma venda encontrada no período selecionado</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Pedidos</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Receita Total</TableHead>
            <TableHead className="text-right">Preço Médio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.sku}>
              <TableCell className="font-mono text-sm">{item.sku}</TableCell>
              <TableCell className="font-medium">{item.product_name}</TableCell>
              <TableCell className="text-right">{item.total_orders}</TableCell>
              <TableCell className="text-right">{item.total_quantity}</TableCell>
              <TableCell className="text-right font-semibold text-green-600">
                R$ {item.total_revenue.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                R$ {item.avg_price.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
```

#### 2.2.4 Adicionar rota

**Arquivo**: `src/App.tsx`

```tsx
import { SalesBySKUPage } from './pages/SalesBySKUPage';

// Adicionar rota
<Route
  path="/sales-by-sku"
  element={
    <ProtectedRoute>
      <SalesBySKUPage />
    </ProtectedRoute>
  }
/>
```

#### 2.2.5 Adicionar menu

**Arquivo**: `src/components/layout/Sidebar.tsx`

```tsx
import { BarChart3 } from 'lucide-react';

// Adicionar item de menu
{
  name: 'Vendas por SKU',
  href: '/sales-by-sku',
  icon: BarChart3
}
```

**Testes**:
- [ ] Página carrega sem erros
- [ ] Seletor de período funciona
- [ ] Presets (7 dias, 30 dias) funcionam
- [ ] Tabela exibe dados corretos
- [ ] Exportar CSV funciona
- [ ] Cards de resumo atualizam

---

## 🟢 FASE 3 - Melhorias (Prioridade Baixa)

### 3.1 Adicionar Filtros Categorizados no Painel de Mensagens 💬

**Objetivo**: Categorizar mensagens por tipo

**Tempo Estimado**: 1 hora

**Arquivos**:
- `src/pages/MessagesPage.tsx`

**Passos**:

#### 3.1.1 Adicionar filtros de categoria

**Arquivo**: `src/pages/MessagesPage.tsx`

```tsx
const [messageCategory, setMessageCategory] = useState<string>('all');

const messageCategories = [
  { value: 'all', label: 'Todas' },
  { value: 'automated_welcome', label: 'Boas-vindas' },
  { value: 'automated_upsell', label: 'Segunda Compra (Upsell)' },
  { value: 'automated_reorder', label: 'Recompra' },
  { value: 'campaign', label: 'Campanhas' },
  { value: 'manual', label: 'Manuais' }
];

// Filtrar mensagens
const filteredMessages = messages.filter(message => {
  // ... filtros existentes

  if (messageCategory !== 'all' && message.send_type !== messageCategory) {
    return false;
  }

  return true;
});

// UI
<Select value={messageCategory} onValueChange={setMessageCategory}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Categoria" />
  </SelectTrigger>
  <SelectContent>
    {messageCategories.map((category) => (
      <SelectItem key={category.value} value={category.value}>
        {category.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

#### 3.1.2 Adicionar cards por categoria

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  <Card>
    <CardContent className="p-4">
      <div className="text-2xl font-bold text-blue-600">
        {messages.filter(m => m.send_type === 'automated_welcome').length}
      </div>
      <div className="text-sm text-gray-600">Boas-vindas</div>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <div className="text-2xl font-bold text-green-600">
        {messages.filter(m => m.send_type === 'automated_upsell').length}
      </div>
      <div className="text-sm text-gray-600">Segunda Compra</div>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <div className="text-2xl font-bold text-orange-600">
        {messages.filter(m => m.send_type === 'automated_reorder').length}
      </div>
      <div className="text-sm text-gray-600">Recompra</div>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <div className="text-2xl font-bold text-purple-600">
        {messages.filter(m => m.send_type === 'campaign').length}
      </div>
      <div className="text-sm text-gray-600">Campanhas</div>
    </CardContent>
  </Card>
</div>
```

**Testes**:
- [ ] Filtro de categoria funciona
- [ ] Cards mostram contagens corretas
- [ ] Cards são clicáveis para filtrar

---

## 📅 CRONOGRAMA ESTIMADO

| Fase | Tempo | Itens |
|------|-------|-------|
| Fase 1 | 3 horas | Auto-confirmação email, Verificação role deletar, Campo verificado clientes |
| Fase 2 | 5 horas | Verificação pedidos, Vendas por SKU |
| Fase 3 | 1 hora | Filtros mensagens |
| **TOTAL** | **9 horas** | **6 funcionalidades** |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1 - Correções Críticas
- [ ] 1.1 Configurar auto-confirmação de email
- [ ] 1.2 Adicionar verificação de role para deletar
- [ ] 1.3 Adicionar campo "verificado" em clientes

### Fase 2 - Funcionalidades Principais
- [ ] 2.1 Implementar verificação de pedidos
- [ ] 2.2 Criar página Vendas por SKU

### Fase 3 - Melhorias
- [ ] 3.1 Adicionar filtros de mensagens

---

## 🚀 ORDEM DE EXECUÇÃO

1. **Configurar Auto-confirmação Email** (30 min) - Dashboard Supabase
2. **Verificação Role Deletar** (1h) - Segurança crítica
3. **Campo Verificado Clientes** (1.5h) - UI simples
4. **Verificação Pedidos** (2h) - Workflow completo
5. **Vendas por SKU** (3h) - Relatório completo
6. **Filtros Mensagens** (1h) - Melhorias

---

**Data de Criação**: 07/01/2026
**Status**: 🚀 Pronto para Implementação
