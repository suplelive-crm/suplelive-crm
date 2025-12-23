### Sistema de Templates com Configurações Avançadas

## 🎯 O Que Mudou

Expandimos o sistema de templates para incluir **configurações de envio** e **filtros avançados**, permitindo controle total sobre quando e para quem cada mensagem é enviada.

---

## 📋 Estrutura da Tabela

```sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  template_type TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,

  -- NOVO: Configurações de timing
  send_config JSONB DEFAULT '{}'::jsonb,

  -- NOVO: Configurações de filtros
  filter_config JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## ⏰ Configurações de Envio (send_config)

### Estrutura do JSONB

```typescript
interface SendConfig {
  timing_type: 'immediate' | 'delayed' | 'before_end';
  delay_value?: number;           // Para timing_type = 'delayed'
  delay_unit?: 'minutes' | 'hours' | 'days'; // Para timing_type = 'delayed'
  days_before_end?: number;       // Para timing_type = 'before_end'
  enabled: boolean;
}
```

### Tipos de Timing

#### 1. Immediate (Imediato)
```json
{
  "timing_type": "immediate",
  "enabled": true
}
```
- Envia **imediatamente** após o evento (criação do pedido)
- Usado para: Boas-vindas

#### 2. Delayed (Com Atraso)
```json
{
  "timing_type": "delayed",
  "delay_value": 5,
  "delay_unit": "minutes",
  "enabled": true
}
```
- Envia **X tempo** após o evento
- Unidades: `minutes`, `hours`, `days`
- Usado para: Oferta de segunda unidade
- Exemplo: 5 minutos, 2 horas, 1 dia

#### 3. Before End (Antes do Fim)
```json
{
  "timing_type": "before_end",
  "days_before_end": 15,
  "enabled": true
}
```
- Envia **X dias antes** do produto acabar
- Cálculo: `data_pedido + duração_produto - days_before_end`
- Usado para: Recompra
- Exemplo: 15 dias antes do fim (produto de 30 dias = envia no dia 15)

---

## 🔍 Configurações de Filtro (filter_config)

### Estrutura do JSONB

```typescript
interface FilterConfig {
  exclude_channels?: string[];     // Canais a NÃO enviar
  min_order_value?: number;        // Valor mínimo do pedido
  max_order_value?: number;        // Valor máximo do pedido
  first_order_only?: boolean;      // Apenas primeira compra
  only_with_duration?: boolean;    // Apenas produtos com duração
}
```

### Exemplos de Filtros

#### Boas-Vindas (Welcome)
```json
{
  "first_order_only": true,
  "exclude_channels": []
}
```
- Envia apenas para **primeira compra** do cliente
- Todos os canais permitidos

#### Oferta de Segunda Unidade (Upsell)
```json
{
  "exclude_channels": ["shop", "atacado", "whatsapp"],
  "min_order_value": 0,
  "max_order_value": null
}
```
- **NÃO envia** para: loja física, atacado, whatsapp
- **ENVIA** para: Mercado Livre, Shopee, etc (marketplaces)
- Qualquer valor de pedido

#### Recompra (Reorder)
```json
{
  "exclude_channels": [],
  "min_order_value": 0,
  "only_with_duration": true
}
```
- Todos os canais permitidos
- Apenas produtos que **têm duração cadastrada** no estoque

---

## 🧮 Função SQL: calculate_send_date

Calcula automaticamente quando enviar a mensagem:

```sql
SELECT calculate_send_date(
  order_date,           -- Data do pedido
  send_config,          -- Configurações de envio (JSONB)
  product_duration_days -- Duração do produto (opcional)
);
```

### Exemplos

**Exemplo 1: Envio Imediato**
```sql
SELECT calculate_send_date(
  '2025-01-01 10:00:00'::timestamptz,
  '{"timing_type": "immediate"}'::jsonb,
  NULL
);
-- Resultado: NOW() (agora)
```

**Exemplo 2: 5 Minutos Depois**
```sql
SELECT calculate_send_date(
  '2025-01-01 10:00:00'::timestamptz,
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
);
-- Resultado: 2025-01-01 10:05:00
```

**Exemplo 3: 15 Dias Antes do Fim (Produto de 30 Dias)**
```sql
SELECT calculate_send_date(
  '2025-01-01 10:00:00'::timestamptz,
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30
);
-- Resultado: 2025-01-16 10:00:00 (dia 1 + 30 dias - 15 dias = dia 16)
```

---

## 💻 Como Usar na Edge Function

### 1. Buscar Template com Configurações

```typescript
import { supabase } from './supabase';

// Buscar template, send_config e filter_config
const { data: template } = await supabase
  .from('message_templates')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('template_type', 'upsell')
  .eq('is_active', true)
  .single();

if (!template) {
  console.log('Template not found, using default');
  return;
}

const { template_content, send_config, filter_config } = template;
```

### 2. Verificar Filtros

```typescript
function shouldSendMessage(
  order: any,
  filterConfig: FilterConfig,
  isFirstOrder: boolean
): boolean {
  // Verificar canal excluído
  if (filterConfig.exclude_channels?.includes(order.canal_venda)) {
    console.log(`Canal ${order.canal_venda} está excluído`);
    return false;
  }

  // Verificar valor mínimo
  if (filterConfig.min_order_value && order.total_amount < filterConfig.min_order_value) {
    console.log(`Valor ${order.total_amount} menor que mínimo ${filterConfig.min_order_value}`);
    return false;
  }

  // Verificar valor máximo
  if (filterConfig.max_order_value && order.total_amount > filterConfig.max_order_value) {
    console.log(`Valor ${order.total_amount} maior que máximo ${filterConfig.max_order_value}`);
    return false;
  }

  // Verificar primeira compra
  if (filterConfig.first_order_only && !isFirstOrder) {
    console.log('Não é primeira compra');
    return false;
  }

  // Verificar duração do produto
  if (filterConfig.only_with_duration && !order.product_duration) {
    console.log('Produto sem duração cadastrada');
    return false;
  }

  return true;
}

// Usar
const shouldSend = shouldSendMessage(order, filter_config, isFirstOrder);
if (!shouldSend) {
  console.log('Mensagem filtrada, não será enviada');
  return;
}
```

### 3. Calcular Data de Envio

```typescript
// Usar a função SQL
const { data: sendDate } = await supabase.rpc('calculate_send_date', {
  p_order_date: order.order_date,
  p_send_config: send_config,
  p_product_duration_days: product.duration_days
});

console.log('Mensagem será enviada em:', sendDate);

// Se envio é imediato
if (send_config.timing_type === 'immediate') {
  // Enviar agora
  await sendWhatsAppMessage(workspaceId, client.phone, message);
} else {
  // Agendar para depois
  await supabase.from('scheduled_messages').insert({
    workspace_id: workspaceId,
    client_id: client.id,
    message_type: 'upsell',
    message_content: message,
    scheduled_for: sendDate,
    status: 'pending'
  });
}
```

### 4. Exemplo Completo: Processar Pedido

```typescript
export async function processOrderUpsell(order: any) {
  // 1. Buscar template
  const { data: template } = await supabase
    .from('message_templates')
    .select('*')
    .eq('workspace_id', order.workspace_id)
    .eq('template_type', 'upsell')
    .eq('is_active', true)
    .single();

  if (!template || !template.send_config.enabled) {
    console.log('Template desabilitado ou não encontrado');
    return;
  }

  // 2. Verificar filtros
  const isFirstOrder = await checkIfFirstOrder(order.client_id);
  const shouldSend = shouldSendMessage(order, template.filter_config, isFirstOrder);

  if (!shouldSend) {
    console.log('Filtros não passaram, mensagem não será enviada');
    return;
  }

  // 3. Calcular preços
  const originalPrice = order.total_amount;
  const discountedPrice = originalPrice * 0.80;

  // 4. Processar template
  const message = replaceTemplateVariables(template.template_content, {
    client_name: order.client.name,
    product_name: order.products[0].name,
    original_price: originalPrice.toFixed(2),
    discounted_price: discountedPrice.toFixed(2)
  });

  // 5. Calcular quando enviar
  const { data: sendDate } = await supabase.rpc('calculate_send_date', {
    p_order_date: order.order_date,
    p_send_config: template.send_config,
    p_product_duration_days: null
  });

  // 6. Enviar ou agendar
  if (template.send_config.timing_type === 'immediate') {
    await sendWhatsAppMessage(order.workspace_id, order.client.phone, message);

    // Marcar como enviado
    await supabase
      .from('orders')
      .update({ mensagem_enviada: true })
      .eq('id', order.id);

    console.log('Mensagem de upsell enviada imediatamente');
  } else {
    await supabase.from('scheduled_messages').insert({
      workspace_id: order.workspace_id,
      client_id: order.client_id,
      message_type: 'upsell',
      message_content: message,
      scheduled_for: sendDate,
      status: 'pending',
      metadata: {
        order_id: order.id,
        template_id: template.id
      }
    });

    console.log(`Mensagem de upsell agendada para: ${sendDate}`);
  }
}
```

---

## 🎨 Interface React (Componente)

Use o componente `MessageTemplateConfigAdvanced.tsx`:

```typescript
import { MessageTemplateConfigAdvanced } from '@/components/automation/MessageTemplateConfigAdvanced';

// Na sua página
<MessageTemplateConfigAdvanced />
```

### Funcionalidades da Interface

1. **Editor de Template**: Editar texto da mensagem
2. **Preview em Tempo Real**: Ver como ficará a mensagem
3. **Configurações de Timing**:
   - Escolher: Imediato, Com Atraso, Antes do Fim
   - Configurar valores (minutos, horas, dias)
   - Habilitar/desabilitar envio
4. **Filtros**:
   - Selecionar canais excluídos (com badges clicáveis)
   - Definir valor mínimo/máximo do pedido
   - Ativar "primeira compra apenas" (welcome)
   - Ativar "apenas com duração" (reorder)
5. **Salvar Tudo**: Salva template + configurações de uma vez

---

## 📊 Canais Disponíveis

```typescript
const AVAILABLE_CHANNELS = [
  { value: 'shop', label: 'Loja Física' },
  { value: 'atacado', label: 'Atacado' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'website', label: 'Site' }
];
```

Adicione novos canais conforme necessário.

---

## 🔄 Migração de Dados Existentes

Se você já tem templates na versão simples, execute:

```sql
-- Adicionar campos novos aos templates existentes
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS send_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '{}'::jsonb;

-- Atualizar templates existentes com configurações padrão
UPDATE message_templates
SET
  send_config = CASE template_type
    WHEN 'welcome' THEN '{"timing_type": "immediate", "enabled": true}'::jsonb
    WHEN 'upsell' THEN '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes", "enabled": true}'::jsonb
    WHEN 'reorder' THEN '{"timing_type": "before_end", "days_before_end": 15, "enabled": true}'::jsonb
  END,
  filter_config = CASE template_type
    WHEN 'welcome' THEN '{"first_order_only": true, "exclude_channels": []}'::jsonb
    WHEN 'upsell' THEN '{"exclude_channels": ["shop", "atacado", "whatsapp"], "min_order_value": 0}'::jsonb
    WHEN 'reorder' THEN '{"exclude_channels": [], "only_with_duration": true, "min_order_value": 0}'::jsonb
  END
WHERE send_config = '{}'::jsonb OR send_config IS NULL;
```

---

## 🧪 Testando Configurações

### Query para Ver Todas as Configurações

```sql
SELECT
  template_type,
  LEFT(template_content, 40) as preview,
  send_config->>'timing_type' as timing,
  send_config->>'enabled' as enabled,
  filter_config->'exclude_channels' as excluded_channels,
  filter_config->>'min_order_value' as min_value
FROM message_templates
WHERE workspace_id = '[seu_workspace_id]'
ORDER BY template_type;
```

### Testar Cálculo de Data

```sql
-- Teste: 5 minutos depois
SELECT calculate_send_date(
  NOW(),
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
) as send_time;

-- Teste: 15 dias antes do fim (produto 30 dias)
SELECT calculate_send_date(
  '2025-01-01'::timestamptz,
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30
) as send_time;
-- Deve retornar: 2025-01-16 (dia 1 + 30 - 15 = dia 16)
```

---

## 📝 Exemplos de Configurações Reais

### Boas-Vindas: Envio Imediato para Primeira Compra

```json
{
  "send_config": {
    "timing_type": "immediate",
    "enabled": true
  },
  "filter_config": {
    "first_order_only": true,
    "exclude_channels": [],
    "min_order_value": 0
  }
}
```

### Upsell: 10 Minutos Depois, Apenas Marketplaces

```json
{
  "send_config": {
    "timing_type": "delayed",
    "delay_value": 10,
    "delay_unit": "minutes",
    "enabled": true
  },
  "filter_config": {
    "exclude_channels": ["shop", "atacado", "whatsapp"],
    "min_order_value": 50,
    "max_order_value": 500
  }
}
```

### Recompra: 10 Dias Antes do Fim, Produtos com Duração

```json
{
  "send_config": {
    "timing_type": "before_end",
    "days_before_end": 10,
    "enabled": true
  },
  "filter_config": {
    "exclude_channels": [],
    "only_with_duration": true,
    "min_order_value": 0
  }
}
```

---

## 🚀 Instalação

### Opção A: Nova Instalação (Recomendado)

Execute: **`EXECUTAR_NO_SUPABASE_COMPLETO.sql`**

### Opção B: Atualizar Instalação Existente

Se já executou `EXECUTAR_NO_SUPABASE_CORRIGIDO.sql`:

```sql
-- Adicionar colunas
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS send_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '{}'::jsonb;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_message_templates_send_config
  ON public.message_templates USING GIN (send_config);

CREATE INDEX IF NOT EXISTS idx_message_templates_filter_config
  ON public.message_templates USING GIN (filter_config);

-- Adicionar configurações padrão (ver query acima)
```

---

## 💡 Benefícios

✅ **Flexibilidade Total**: Configure timing por template
✅ **Filtros Avançados**: Controle preciso de quando enviar
✅ **Sem Código**: Tudo via interface visual
✅ **Escalável**: Adicione novos filtros facilmente via JSONB
✅ **Testável**: Funções SQL para calcular datas
✅ **Auditável**: Tudo registrado no banco

---

## 🔮 Futuras Expansões

Ideias para expandir o sistema:

1. **Horário de Envio**: Não enviar fora do horário comercial
2. **Dias da Semana**: Enviar apenas em dias úteis
3. **A/B Testing**: Múltiplos templates ativos com % de distribuição
4. **Prioridade**: Ordem de envio quando múltiplas mensagens
5. **Cooldown**: Não enviar se já enviou X mensagens em Y dias
6. **Segmentação**: Filtros por cidade, estado, idade, etc

Todos podem ser adicionados ao `filter_config` JSONB sem alterar schema!

---

**Última atualização**: 23/12/2025
