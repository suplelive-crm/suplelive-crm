# 📝 Como Usar Templates de Mensagens Personalizados

> **Criado em**: 23 de Dezembro de 2025
> **Versão**: 1.0

Este guia explica como usar e personalizar os templates de mensagens automáticas no SupleLive CRM.

---

## 📋 Índice

1. [O que são Templates](#o-que-são-templates)
2. [Acessando os Templates](#acessando-os-templates)
3. [Tipos de Templates](#tipos-de-templates)
4. [Variáveis Disponíveis](#variáveis-disponíveis)
5. [Como Editar](#como-editar)
6. [Preview em Tempo Real](#preview-em-tempo-real)
7. [Integração com Edge Functions](#integração-com-edge-functions)

---

## 🎯 O que são Templates

Templates são **modelos de mensagens** que você pode personalizar para serem enviadas automaticamente em diferentes momentos da jornada do cliente:

- **Boas-Vindas**: Enviada para novos clientes após o primeiro pedido
- **Venda Casada**: Enviada imediatamente após a criação do pedido
- **Recompra**: Agendada para quando o produto estiver acabando

### Benefícios:
✅ **Personalização total**: Escreva mensagens com a identidade da sua marca
✅ **Preview instantâneo**: Veja como a mensagem ficará antes de salvar
✅ **Variáveis dinâmicas**: Use dados reais do cliente e pedido
✅ **Workspace-specific**: Cada workspace tem seus próprios templates

---

## 🚪 Acessando os Templates

### Via Menu Lateral:
1. Faça login no SupleLive CRM
2. No menu lateral, clique em **"Templates"**
3. Você verá 3 abas: Boas-Vindas, Venda Casada, Recompra

### Via URL Direta:
```
https://seu-crm.com/message-templates
```

---

## 📨 Tipos de Templates

### 1. Mensagem de Boas-Vindas

**Quando é enviada:**
- Cliente faz o primeiro pedido
- Sistema cria novo registro de cliente
- Enviado **imediatamente** após criação

**Objetivo:**
- Causar boa primeira impressão
- Confirmar recebimento do pedido
- Oferecer suporte

**Template Padrão:**
```
Olá {{client_name}}! 👋

Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.

Qualquer dúvida, estou à disposição! 😊
```

**Variáveis Disponíveis:**
- `{{client_name}}` - Nome do cliente
- `{{order_id}}` - ID do pedido

---

### 2. Mensagem de Venda Casada (Upsell)

**Quando é enviada:**
- Após criação de qualquer pedido
- Enviado **imediatamente** (segundos após o pedido)
- Tanto para clientes novos quanto existentes

**Objetivo:**
- Sugerir produtos complementares
- Aumentar ticket médio
- Cross-sell inteligente

**Template Padrão:**
```
Olá {{client_name}}! 🎉

Obrigado pelo seu pedido!

Clientes que compraram os mesmos produtos também gostaram de:

{{product_list}}

Quer aproveitar? Posso adicionar ao seu pedido! 😊
```

**Variáveis Disponíveis:**
- `{{client_name}}` - Nome do cliente
- `{{order_id}}` - ID do pedido
- `{{product_list}}` - Lista formatada de produtos sugeridos
  - Exemplo: `• Vitamina C - R$ 45,00\n• Ômega 3 - R$ 89,90`
- `{{order_total}}` - Valor total do pedido
  - Exemplo: `R$ 254,90`

**Como funciona a lista de produtos:**
1. Sistema pega SKUs do pedido atual
2. Busca até 3 produtos complementares que **não** estão no pedido
3. Formata como lista com bullet points
4. Substitui `{{product_list}}` pela lista formatada

---

### 3. Mensagem de Recompra

**Quando é enviada:**
- **Agendada** para data futura (não é imediata)
- Data calculada: `data_pedido + (duração × quantidade) - 15 dias`
- Exemplo: Produto de 30 dias, comprou 2 = mensagem em 45 dias

**Objetivo:**
- Lembrar cliente de repor o produto antes de acabar
- Aumentar retenção
- Facilitar recompra

**Template Padrão:**
```
Olá {{client_name}}!

O produto "{{product_name}}" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊
```

**Variáveis Disponíveis:**
- `{{client_name}}` - Nome do cliente
- `{{product_name}}` - Nome do produto
- `{{product_sku}}` - SKU do produto
- `{{order_date}}` - Data do pedido original
- `{{duration_days}}` - Duração total calculada (duração × quantidade)

---

## 🔤 Variáveis Disponíveis

### Sintaxe:
```
{{nome_da_variavel}}
```

### Lista Completa por Tipo:

| Variável | Boas-Vindas | Venda Casada | Recompra | Descrição |
|----------|-------------|--------------|----------|-----------|
| `{{client_name}}` | ✅ | ✅ | ✅ | Nome do cliente |
| `{{order_id}}` | ✅ | ✅ | ❌ | ID do pedido |
| `{{product_list}}` | ❌ | ✅ | ❌ | Lista de produtos sugeridos |
| `{{order_total}}` | ❌ | ✅ | ❌ | Valor total do pedido |
| `{{product_name}}` | ❌ | ❌ | ✅ | Nome do produto |
| `{{product_sku}}` | ❌ | ❌ | ✅ | SKU do produto |
| `{{order_date}}` | ❌ | ❌ | ✅ | Data do pedido original |
| `{{duration_days}}` | ❌ | ❌ | ✅ | Dias de duração calculados |

### ⚠️ Importante:
- Variáveis devem estar **exatamente** como mostrado
- Use `{{` e `}}` (chaves duplas)
- Não adicione espaços: `{{ client_name }}` ❌ | `{{client_name}}` ✅
- Se usar variável não disponível, ela não será substituída

---

## ✏️ Como Editar

### Passo a Passo:

1. **Acesse a página de Templates**
   - Menu lateral → Templates

2. **Escolha a aba**
   - Boas-Vindas, Venda Casada ou Recompra

3. **Edite o template**
   - Digite no campo de texto à esquerda
   - Use variáveis quando quiser dados dinâmicos
   - Adicione emojis para deixar mais amigável

4. **Veja o preview**
   - À direita, veja como a mensagem ficará
   - Preview mostra a mensagem formatada no estilo WhatsApp

5. **Teste com dados diferentes**
   - Altere os "Dados de Exemplo" abaixo do preview
   - Veja como a mensagem muda

6. **Salve**
   - Clique em "Salvar Template"
   - Confirmação aparecerá

7. **Restaurar padrão (opcional)**
   - Clique em "Restaurar Padrão" para voltar ao original

---

## 👁️ Preview em Tempo Real

### Como funciona:
- À direita do editor, você vê um **preview ao vivo**
- Aparece como mensagem do WhatsApp (bolha verde)
- Mostra exatamente como o cliente verá

### Dados de Exemplo:
Por padrão, o preview usa:
```typescript
{
  client_name: 'João Silva',
  order_id: '12345',
  product_list: '• Vitamina C 1000mg - R$ 45,00\n• Ômega 3 Premium - R$ 89,90\n• Whey Protein 900g - R$ 120,00',
  order_total: 'R$ 254,90',
  product_name: 'Vitamina C 1000mg',
  product_sku: 'VIT-C-1000',
  order_date: '23/12/2025',
  duration_days: '60'
}
```

### Testando cenários:
1. Altere o nome do cliente nos "Dados de Exemplo"
2. Veja o preview atualizar instantaneamente
3. Teste diferentes produtos, valores, etc
4. Certifique-se que a mensagem faz sentido em todos os casos

---

## 🔧 Integração com Edge Functions

### Como as Edge Functions usam os templates:

#### 1. Importar o helper
```typescript
import {
  getWelcomeMessage,
  getUpsellMessage,
  getReorderMessage
} from '../_shared/message-templates.ts';
```

#### 2. Buscar e processar template

**Boas-Vindas:**
```typescript
const message = await getWelcomeMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base
});
```

**Venda Casada:**
```typescript
const productList = complementaryProducts
  .map((p) => `• ${p.name} - R$ ${p.price.toFixed(2)}`)
  .join('\n');

const message = await getUpsellMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base,
  product_list: productList,
  order_total: `R$ ${order.total_amount.toFixed(2)}`
});
```

**Recompra:**
```typescript
const message = await getReorderMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: productData.name,
  product_sku: product.sku,
  order_date: new Date(order.order_date).toLocaleDateString('pt-BR'),
  duration_days: durationDays
});
```

### Fluxo Completo:

```
┌─────────────────────────────────────────────────────────┐
│  1. Edge Function chamada                               │
│     ├─ process-order-created                            │
│     └─ send-scheduled-messages                          │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  2. Busca template do banco                             │
│     ├─ getMessageTemplate(workspace_id, type)           │
│     └─ Se não encontrar, usa template padrão            │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  3. Substitui variáveis                                 │
│     ├─ replaceTemplateVariables(template, data)         │
│     └─ {{client_name}} → "João Silva"                   │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  4. Envia via WhatsApp                                  │
│     ├─ sendWhatsAppMessage(phone, message)              │
│     └─ Evolution API                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 💡 Dicas e Boas Práticas

### ✅ Faça:
- Use emojis com moderação (2-3 por mensagem)
- Mantenha mensagens curtas e objetivas
- Teste diferentes abordagens com clientes
- Use tom amigável mas profissional
- Personalize com o nome do cliente sempre

### ❌ Evite:
- Mensagens muito longas (mais de 10 linhas)
- Excesso de emojis
- Linguagem muito formal
- Promessas que não pode cumprir
- Forçar venda agressivamente

### 📝 Exemplos Alternativos:

**Boas-Vindas (Informal):**
```
E aí, {{client_name}}! 🎉

Showww! Seu pedido #{{order_id}} chegou aqui!

Já tô preparando tudo com muito carinho ❤️

Qualquer dúvida, pode mandar! 💬
```

**Venda Casada (Descontos):**
```
Opa, {{client_name}}! 🛍️

Vi que você comprou e tô com uma oferta especial:

{{product_list}}

Aproveita! É só hoje! ⚡
```

**Recompra (Urgente):**
```
🚨 {{client_name}}, atenção!

Seu {{product_name}} tá no finzinho!

Garante logo o seu antes que acabe!

Link: [SEU LINK AQUI] 🔗
```

---

## 🗄️ Banco de Dados

### Tabela: `message_templates`

```sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  template_type TEXT NOT NULL, -- 'welcome', 'upsell', 'reorder'
  template_content TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Funções SQL Disponíveis:

**Buscar template:**
```sql
SELECT get_message_template('[workspace_id]', 'welcome');
```

**Substituir variáveis:**
```sql
SELECT replace_template_variables(
  'Olá {{name}}!',
  '{"name": "João"}'::jsonb
);
-- Retorna: 'Olá João!'
```

---

## 🔄 Atualizando Edge Functions (Para Desenvolvedores)

### Antes (hardcoded):
```typescript
const message = `
Olá ${client.name}! 👋
Obrigado por escolher nossa loja!
`.trim();
```

### Depois (usando templates):
```typescript
import { getWelcomeMessage } from '../_shared/message-templates.ts';

const message = await getWelcomeMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base
});
```

### Benefícios:
- ✅ Cliente pode customizar sem mexer no código
- ✅ Fallback automático para template padrão
- ✅ Logs de erro se falhar
- ✅ Type-safe com TypeScript

---

## ❓ FAQ

**P: Posso usar HTML nas mensagens?**
R: Não. As mensagens são enviadas via WhatsApp (texto puro). Use quebras de linha (`\n`) e emojis para formatação.

**P: Posso criar variáveis customizadas?**
R: Não no momento. Use apenas as variáveis disponíveis para cada tipo de template.

**P: E se eu deletar uma variável do template?**
R: A mensagem será enviada sem aquele dado. Exemplo: se remover `{{client_name}}`, não haverá nome na mensagem.

**P: Posso ter múltiplos templates do mesmo tipo?**
R: Não. Apenas um template ativo por tipo por workspace.

**P: Como voltar ao template padrão?**
R: Clique em "Restaurar Padrão" na tela de edição.

**P: As mudanças afetam pedidos antigos?**
R: Não. Apenas pedidos **novos** (criados após salvar) usarão o novo template.

**P: Posso testar antes de salvar?**
R: Sim! Use o preview ao vivo à direita. Altere os "Dados de Exemplo" para testar diferentes cenários.

---

**Fim do Guia** 🎉

Para dúvidas técnicas, consulte:
- `src/components/automation/MessageTemplatesConfig.tsx`
- `supabase/functions/_shared/message-templates.ts`
- `AUTOMACOES_MENSAGENS.md`
