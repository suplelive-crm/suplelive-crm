# 📋 Resumo Completo - Sistema de Templates com Configurações Avançadas

## ✅ O Que Foi Implementado

### 1. Estrutura de Banco de Dados

**Tabela**: `message_templates`

```sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  template_type TEXT NOT NULL, -- 'welcome', 'upsell', 'reorder'
  template_content TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,

  -- CONFIGURAÇÕES AVANÇADAS
  send_config JSONB DEFAULT '{}'::jsonb,    -- Timing de envio
  filter_config JSONB DEFAULT '{}'::jsonb,  -- Filtros de quando enviar

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Funções SQL**:
- `get_message_template()` - Busca template com configurações
- `replace_template_variables()` - Substitui variáveis {{name}}
- `calculate_send_date()` - Calcula quando enviar baseado em configurações

---

## 📂 Arquivos Criados/Atualizados

### SQL (Banco de Dados)

1. **EXECUTAR_NO_SUPABASE_CORRIGIDO.sql** ✅
   - Versão simples (sem configurações avançadas)
   - Corrigido para usar `workspaces.owner_id`
   - Templates padrão para boas-vindas, upsell, recompra

2. **EXECUTAR_NO_SUPABASE_COMPLETO.sql** ⭐ (RECOMENDADO)
   - Versão completa com configurações avançadas
   - Campos `send_config` e `filter_config` (JSONB)
   - Função `calculate_send_date()` para cálculos automáticos
   - Templates com configurações padrão

### Componentes React

3. **src/components/automation/MessageTemplatesConfig.tsx** ✅
   - Versão simples
   - Editor + preview
   - Sem configurações avançadas

4. **src/components/automation/MessageTemplateConfigAdvanced.tsx** ⭐ (RECOMENDADO)
   - Versão completa com configurações
   - **Editor de template** com syntax highlighting
   - **Preview em tempo real** estilo WhatsApp
   - **Configurações de timing**:
     - Imediato / Com atraso / Antes do fim
     - UI com Select e Input numérico
     - Switch para habilitar/desabilitar
   - **Filtros avançados**:
     - Badges clicáveis para canais excluídos
     - Inputs para valor mínimo/máximo
     - Switches para opções específicas
   - **Info cards** com descrição do timing

5. **src/pages/MessageTemplatesPage.tsx** ✅
   - Atualizado para usar `MessageTemplateConfigAdvanced`

### Helper Functions

6. **supabase/functions/_shared/message-templates.ts** ✅
   - `getMessageTemplate()` - Busca do banco
   - `replaceTemplateVariables()` - Substitui {{vars}}
   - `getWelcomeMessage()` - Helper para welcome
   - `getUpsellMessage()` - Helper para upsell (corrigido)
   - `getReorderMessage()` - Helper para reorder
   - Fallback para templates padrão

### Documentação

7. **CORRECAO_VENDA_CASADA.md** ✅
   - Explicação da correção feita
   - Análise do workflow n8n original
   - Como funciona a oferta de segunda unidade (20% desconto)

8. **TEMPLATES_AVANCADO.md** ⭐
   - Documentação técnica completa
   - Estrutura de `send_config` e `filter_config`
   - Exemplos de uso nas Edge Functions
   - Query examples e testes

9. **INSTALAR_TEMPLATES_AVANCADO.md** ⭐
   - Guia rápido de instalação em 3 passos
   - Migração de versão simples para avançada
   - Troubleshooting
   - Checklist de verificação

10. **EXECUTAR_AGORA.md** ✅
    - Guia original (versão simples)
    - Instruções de instalação e teste

11. **RESUMO_SISTEMA_TEMPLATES.md** (este arquivo)
    - Overview completo do sistema

---

## 🎯 Tipos de Mensagens

### 1. Boas-Vindas (Welcome)

**Quando**: Primeiro pedido do cliente
**Timing padrão**: Imediato
**Filtros padrão**: Apenas primeira compra

**Variáveis**:
- `{{client_name}}` - Nome do cliente
- `{{order_id}}` - ID do pedido

**Template padrão**:
```
Olá {{client_name}}! 👋

Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.

Qualquer dúvida, estou à disposição! 😊
```

---

### 2. Oferta de Segunda Unidade (Upsell)

**Quando**: Após pedido de canais específicos (marketplaces)
**Timing padrão**: 5 minutos após pedido
**Filtros padrão**: Excluir shop, atacado, whatsapp

**Variáveis**:
- `{{client_name}}` - Nome do cliente
- `{{product_name}}` - Nome do produto
- `{{original_price}}` - Preço original
- `{{discounted_price}}` - Preço com 20% desconto

**Template padrão**:
```
Oi, {{client_name}}! Tudo bem? 😀

Confirmamos sua compra do {{product_name}} e tenho uma surpresa especial pra você:

✨ Leve mais 1 unidade com desconto exclusivo no Pix!

👉 Cada unidade adicional sai por R$ {{discounted_price}} no Pix.
📦 O envio vai junto com o seu pedido.
⏳ Oferta válida por 1 hora a partir do recebimento desta mensagem.

É só me responder "SIM" aqui mesmo que já adiciono pra você. 😉
```

**Observação**: NÃO é venda de produtos complementares, é segunda unidade DO MESMO PRODUTO com 20% off.

---

### 3. Recompra (Reorder)

**Quando**: Produto está acabando (baseado na duração)
**Timing padrão**: 15 dias antes do fim
**Filtros padrão**: Apenas produtos com duração cadastrada

**Variáveis**:
- `{{client_name}}` - Nome do cliente
- `{{product_name}}` - Nome do produto
- `{{product_sku}}` - SKU do produto
- `{{order_date}}` - Data do pedido original
- `{{duration_days}}` - Duração do produto em dias

**Template padrão**:
```
Olá {{client_name}}!

O produto "{{product_name}}" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊
```

**Cálculo**: `data_pedido + duração_produto - 15 dias`
- Exemplo: Pedido dia 01/01, produto de 30 dias → envia dia 16/01

---

## ⚙️ Configurações de Envio (send_config)

### Tipos de Timing

#### 1. Immediate (Imediato)
```json
{
  "timing_type": "immediate",
  "enabled": true
}
```
Envia na hora, assim que o evento acontece.

#### 2. Delayed (Com Atraso)
```json
{
  "timing_type": "delayed",
  "delay_value": 5,
  "delay_unit": "minutes",
  "enabled": true
}
```
Envia X tempo depois do evento.
- Unidades: `minutes`, `hours`, `days`

#### 3. Before End (Antes do Fim)
```json
{
  "timing_type": "before_end",
  "days_before_end": 15,
  "enabled": true
}
```
Envia X dias antes do produto acabar.
- Requer: `product_duration_days` no cálculo

---

## 🔍 Configurações de Filtro (filter_config)

### Opções Disponíveis

```json
{
  "exclude_channels": ["shop", "atacado", "whatsapp"],
  "min_order_value": 50,
  "max_order_value": 500,
  "first_order_only": true,
  "only_with_duration": true
}
```

**Campos**:
- `exclude_channels` - Array de canais a NÃO enviar
- `min_order_value` - Valor mínimo do pedido (R$)
- `max_order_value` - Valor máximo do pedido (R$)
- `first_order_only` - Apenas primeira compra (boolean)
- `only_with_duration` - Apenas produtos com duração (boolean)

**Lógica**: Mensagem enviada apenas se **TODOS** os filtros passarem.

---

## 🚀 Como Instalar

### Nova Instalação

1. Execute: `EXECUTAR_NO_SUPABASE_COMPLETO.sql`
2. Acesse: http://localhost:5173/message-templates
3. Configure templates via interface

### Migração (de versão simples)

Se já executou `EXECUTAR_NO_SUPABASE_CORRIGIDO.sql`:

1. Veja instruções em `INSTALAR_TEMPLATES_AVANCADO.md`
2. Execute queries de migração (adicionar colunas)
3. Atualize templates com configurações padrão

---

## 💻 Como Usar nas Edge Functions

### Exemplo Completo

```typescript
import { supabase } from './supabase';

async function processOrderWithTemplate(order: any) {
  // 1. Buscar template
  const { data: template } = await supabase
    .from('message_templates')
    .select('*')
    .eq('workspace_id', order.workspace_id)
    .eq('template_type', 'upsell')
    .eq('is_active', true)
    .single();

  if (!template || !template.send_config.enabled) {
    return; // Template desabilitado
  }

  // 2. Verificar filtros
  if (template.filter_config.exclude_channels?.includes(order.canal_venda)) {
    console.log('Canal excluído');
    return;
  }

  if (order.total_amount < (template.filter_config.min_order_value || 0)) {
    console.log('Valor abaixo do mínimo');
    return;
  }

  // 3. Processar template
  const originalPrice = order.total_amount;
  const discountedPrice = originalPrice * 0.80;

  let message = template.template_content;
  message = message.replace(/\{\{client_name\}\}/g, order.client.name);
  message = message.replace(/\{\{product_name\}\}/g, order.products[0].name);
  message = message.replace(/\{\{original_price\}\}/g, originalPrice.toFixed(2));
  message = message.replace(/\{\{discounted_price\}\}/g, discountedPrice.toFixed(2));

  // 4. Calcular quando enviar
  const { data: sendDate } = await supabase.rpc('calculate_send_date', {
    p_order_date: order.order_date,
    p_send_config: template.send_config,
    p_product_duration_days: null
  });

  // 5. Enviar ou agendar
  if (template.send_config.timing_type === 'immediate') {
    await sendWhatsAppMessage(order.workspace_id, order.client.phone, message);
  } else {
    await supabase.from('scheduled_messages').insert({
      workspace_id: order.workspace_id,
      client_id: order.client_id,
      message_type: 'upsell',
      message_content: message,
      scheduled_for: sendDate,
      status: 'pending'
    });
  }
}
```

---

## 📊 Interface do Usuário

### Página: /message-templates

**Layout**: 2 colunas
- **Esquerda**: Editor + Configurações
- **Direita**: Preview + Info

**Features**:
1. **Abas**: Welcome, Upsell, Reorder
2. **Editor**: Textarea com template
3. **Variáveis disponíveis**: Badges com {{vars}}
4. **Config de Timing**:
   - Switch para habilitar/desabilitar
   - Select: Imediato / Com Atraso / Antes do Fim
   - Inputs para valores (minutos, horas, dias)
   - Descrição visual do timing
5. **Config de Filtros**:
   - Badges clicáveis para canais
   - Inputs para valor min/max
   - Switches para opções específicas
6. **Preview**:
   - Estilo WhatsApp (bolha verde)
   - Atualização em tempo real
   - Horário atual
7. **Info Card**: Timing visual com ícone
8. **Botões**: Salvar / Restaurar Padrão

---

## 🧪 Testes

### Query de Verificação

```sql
SELECT
  template_type,
  LEFT(template_content, 40) as preview,
  send_config->>'timing_type' as timing,
  send_config->>'enabled' as habilitado,
  filter_config->'exclude_channels' as excluir_canais
FROM message_templates
WHERE workspace_id = '[seu_workspace_id]'
ORDER BY template_type;
```

### Testar Cálculo de Data

```sql
-- Imediato
SELECT calculate_send_date(
  NOW(),
  '{"timing_type": "immediate"}'::jsonb,
  NULL
);

-- 5 minutos depois
SELECT calculate_send_date(
  NOW(),
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
);

-- 15 dias antes do fim (produto 30 dias)
SELECT calculate_send_date(
  '2025-01-01'::timestamptz,
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30
);
```

---

## 🎓 Referências Rápidas

| Documento | Conteúdo |
|-----------|----------|
| **INSTALAR_TEMPLATES_AVANCADO.md** | Guia de instalação rápido |
| **TEMPLATES_AVANCADO.md** | Documentação técnica completa |
| **CORRECAO_VENDA_CASADA.md** | Explicação sobre upsell |
| **EXECUTAR_NO_SUPABASE_COMPLETO.sql** | Script SQL completo |
| **MessageTemplateConfigAdvanced.tsx** | Componente React |

---

## 🔮 Próximas Expansões Possíveis

1. **Horário de funcionamento**: Não enviar fora do horário
2. **Dias da semana**: Apenas dias úteis
3. **A/B Testing**: Múltiplos templates com % distribuição
4. **Cooldown**: Limite de mensagens por período
5. **Segmentação**: Por cidade, estado, idade
6. **Prioridade**: Ordem de envio quando múltiplas mensagens
7. **Webhook callbacks**: Notificar quando mensagem enviada

Tudo pode ser adicionado via JSONB sem alterar schema! 🚀

---

## ✅ Status Atual

- [x] Banco de dados estruturado
- [x] Funções SQL criadas
- [x] Componente React completo
- [x] Documentação técnica
- [x] Guias de instalação
- [x] Exemplos de uso
- [x] Templates padrão configurados
- [x] Interface totalmente funcional

**Sistema 100% pronto para uso!** 🎉

---

**Última atualização**: 23/12/2025
**Versão**: 2.0 (Avançado)
