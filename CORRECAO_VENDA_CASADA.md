# Correção: Venda Casada → Oferta de Segunda Unidade

## ✅ O Que Foi Corrigido

A funcionalidade anteriormente descrita como "venda casada com produtos complementares" foi corrigida para refletir o comportamento real do sistema:

### ❌ Antes (Incorreto)
- Template sugeria produtos complementares/relacionados
- Variáveis: `product_list`, `order_total`
- Mensagem: "Clientes que compraram também gostaram de: [lista de produtos]"

### ✅ Agora (Correto)
- Template oferece **segunda unidade DO MESMO produto** com 20% de desconto
- Variáveis: `product_name`, `original_price`, `discounted_price`
- Mensagem: "Leve mais 1 unidade com desconto exclusivo no Pix!"

---

## 📋 Como Funciona (Baseado no n8n)

### Fluxo da Automação (Agente___Venda_Casada.json)

1. **Trigger**: A cada 1 minuto, busca pedidos com:
   - `mensagem_enviada = false`
   - `canal_venda` diferente de: `shop`, `atacado`, `whatsapp`
   - `order_date` maior que 31/10/2025

2. **Processamento**:
   - Busca dados do cliente pelo `client_id`
   - Extrai primeiro produto do pedido (metadata[0])
   - Calcula preço com desconto: `precoOriginal * 0.80` (20% off)
   - Verifica se produto tem imagem cadastrada

3. **Envio**:
   - Se produto tem imagem → envia imagem com caption
   - Se não tem imagem → envia só texto
   - Marca `mensagem_enviada = true` no pedido

4. **Mensagem**:
   ```
   Oi, [Nome]! Tudo bem? 😀

   Confirmamos sua compra do [Produto] e tenho uma surpresa especial pra você:

   ✨ Leve mais 1 unidade com desconto exclusivo no Pix!

   👉 Cada unidade adicional sai por R$ [Preço com 20% off] no Pix.
   📦 O envio vai junto com o seu pedido.
   ⏳ Oferta válida por 1 hora a partir do recebimento desta mensagem.

   É só me responder "SIM" aqui mesmo que já adiciono pra você. 😉
   ```

---

## 📂 Arquivos Atualizados

### 1. SQL Migration (EXECUTAR_NO_SUPABASE_CORRIGIDO.sql)

**Linha 171-184**: Template padrão atualizado

```sql
-- Template de Venda Casada (segunda unidade com desconto)
INSERT INTO public.message_templates (
  workspace_id,
  template_type,
  template_content,
  variables,
  is_active
) VALUES (
  v_workspace.id,
  'upsell',
  E'Oi, {{client_name}}! Tudo bem? 😀\n\n...',
  ARRAY['client_name', 'product_name', 'original_price', 'discounted_price'],
  true
)
```

**Variáveis**:
- `client_name` - Nome do cliente
- `product_name` - Nome do produto comprado
- `original_price` - Preço original do produto
- `discounted_price` - Preço com 20% de desconto

---

### 2. Helper TypeScript (supabase/functions/_shared/message-templates.ts)

**Linha 21-31**: Template padrão

```typescript
upsell: `Oi, {{client_name}}! Tudo bem? 😀

Confirmamos sua compra do {{product_name}} e tenho uma surpresa especial pra você:

✨ Leve mais 1 unidade com desconto exclusivo no Pix!

👉 Cada unidade adicional sai por R$ {{discounted_price}} no Pix.
📦 O envio vai junto com o seu pedido.
⏳ Oferta válida por 1 hora a partir do recebimento desta mensagem.

É só me responder "SIM" aqui mesmo que já adiciono pra você. 😉`
```

**Linha 109-124**: Função `getUpsellMessage` atualizada

```typescript
export async function getUpsellMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  variables: {
    client_name: string;
    product_name: string;
    original_price: string;
    discounted_price: string;
  }
): Promise<string>
```

---

### 3. Componente React (src/components/automation/MessageTemplatesConfig.tsx)

**Linha 33-43**: Template padrão atualizado

**Linha 54-58**: Variáveis corrigidas
```typescript
const TEMPLATE_VARIABLES = {
  welcome: ['client_name', 'order_id'],
  upsell: ['client_name', 'product_name', 'original_price', 'discounted_price'],
  reorder: ['client_name', 'product_name', 'product_sku', 'order_date', 'duration_days']
};
```

**Linha 70-79**: Preview data atualizado
```typescript
const [previewData, setPreviewData] = useState({
  client_name: 'João Silva',
  order_id: '12345',
  product_name: 'Vitamina C 1000mg',
  original_price: '89,90',
  discounted_price: '71,92', // 20% off
  product_sku: 'VIT-C-1000',
  order_date: new Date().toLocaleDateString('pt-BR'),
  duration_days: '60'
});
```

**Linha 349**: Label da aba atualizado
```typescript
'Oferta de Segunda Unidade'
```

**Linha 350**: Descrição atualizada
```typescript
'Oferta de segunda unidade com 20% de desconto, enviada após pedidos de canais específicos'
```

---

## 🔄 Como Usar no Edge Function

Quando migrar o fluxo n8n para Edge Function, use assim:

```typescript
import { getUpsellMessage } from '../_shared/message-templates.ts';

// Calcular preço com desconto
const originalPrice = orderProduct.receita_produto; // ou productData.price
const discountedPrice = originalPrice * 0.80;

// Buscar e processar template
const message = await getUpsellMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: orderProduct.nome_produto,
  original_price: originalPrice.toFixed(2),
  discounted_price: discountedPrice.toFixed(2)
});

// Enviar via WhatsApp
await sendWhatsAppMessage(workspaceId, client.phone, message);

// Marcar como enviado
await supabase
  .from('orders')
  .update({ mensagem_enviada: true })
  .eq('id', order.id);
```

---

## 📊 Critérios de Envio

A mensagem é enviada APENAS se:

✅ `mensagem_enviada = false`
✅ `canal_venda` NÃO é: `shop`, `atacado`, `whatsapp`
✅ `order_date` é maior que 31/10/2025

Ou seja, pedidos de canais específicos (provavelmente marketplaces como Mercado Livre, Shopee, etc).

---

## 🎯 Próximos Passos

1. ✅ **SQL executado** - Execute `EXECUTAR_NO_SUPABASE_CORRIGIDO.sql`
2. ✅ **Interface funcionando** - Acesse `/message-templates`
3. 🔄 **Migrar n8n para Edge Function** (opcional)
   - Criar `process-upsell-offer/index.ts`
   - Implementar lógica de verificação de canal
   - Calcular desconto de 20%
   - Enviar mensagem usando template do banco

---

## 📝 Notas Técnicas

- **Desconto fixo**: 20% (0.80 do preço original)
- **Prazo da oferta**: 1 hora (informado na mensagem)
- **Benefício**: Frete grátis (envio junto com pedido original)
- **Canal de resposta**: WhatsApp (cliente responde "SIM")
- **Imagem**: Se cadastrada no produto, envia com caption

---

**Última atualização**: 23/12/2025
**Baseado em**: `Briefing/Agente___Venda_Casada.json`
