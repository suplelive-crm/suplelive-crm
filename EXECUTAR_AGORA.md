# ⚡ Execute Agora - Templates de Mensagens

## 🎯 O Que Fazer

Você está pronto para instalar o sistema de templates personalizados! Siga os passos abaixo:

---

## 📝 PASSO 1: Executar SQL no Supabase

### 1.1 Acesse o SQL Editor

```
https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
```

### 1.2 Abra o Arquivo Correto

**IMPORTANTE**: Use o arquivo **EXECUTAR_NO_SUPABASE_CORRIGIDO.sql** (não o sem "_CORRIGIDO")

Este arquivo foi corrigido para funcionar com sua estrutura de banco de dados que usa `workspaces.owner_id` ao invés de uma tabela `workspace_users`.

### 1.3 Execute

1. Copie **TODO** o conteúdo do arquivo `EXECUTAR_NO_SUPABASE_CORRIGIDO.sql`
2. Cole no SQL Editor do Supabase
3. Clique em **"RUN"** ou pressione **Ctrl+Enter**
4. Aguarde a mensagem: ✅ **"Success. No rows returned"**

---

## ✅ PASSO 2: Verificar se Funcionou

### Query de Verificação

Cole esta query no SQL Editor para confirmar:

```sql
-- Ver templates criados por workspace
SELECT
  w.name as workspace_name,
  mt.template_type,
  LEFT(mt.template_content, 50) as preview,
  mt.is_active
FROM message_templates mt
JOIN workspaces w ON w.id = mt.workspace_id
ORDER BY w.name, mt.template_type;
```

**Resultado esperado**: Você deve ver 3 templates por workspace (welcome, upsell, reorder).

---

## 🎨 PASSO 3: Testar a Interface

### 3.1 Iniciar o Servidor

```bash
npm run dev
```

### 3.2 Acessar a Página

```
http://localhost:5173/message-templates
```

Ou pelo menu lateral: **Templates** (ícone FileText)

### 3.3 Testar Funcionalidades

1. **Editar template** - Modifique o texto em qualquer aba
2. **Ver preview** - Observe o preview ao vivo à direita
3. **Alterar dados de exemplo** - Veja o preview mudar
4. **Salvar** - Clique em "Salvar Template"
5. **Verificar no banco** - Execute a query acima novamente

---

## 🔧 PASSO 4: (Opcional) Atualizar Edge Functions

Atualmente as Edge Functions usam templates hardcoded. Para usar os templates do banco de dados:

### 4.1 Abrir Edge Function

Arquivo: `supabase/functions/process-order-created/index.ts`

### 4.2 Importar Helpers

Adicione no topo do arquivo:

```typescript
import {
  getWelcomeMessage,
  getUpsellMessage,
  getReorderMessage
} from '../_shared/message-templates.ts';
```

### 4.3 Substituir Mensagens Hardcoded

**Para Boas-Vindas** (busque por "Olá" + "Obrigado por escolher"):
```typescript
// ANTES (hardcoded)
const message = `
Olá ${client.name}! 👋
Obrigado por escolher nossa loja!
...
`.trim();

// DEPOIS (usando template do banco)
const message = await getWelcomeMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base?.toString() || ''
});
```

**Para Oferta de Segunda Unidade** (busque por "Leve mais 1 unidade"):
```typescript
// ANTES
const message = `
Oi ${client.name}! Tudo bem?
Confirmamos sua compra do ${productName}...
`.trim();

// DEPOIS
// Calcular desconto de 20%
const originalPrice = orderProduct.receita_produto;
const discountedPrice = originalPrice * 0.80;

const message = await getUpsellMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: orderProduct.nome_produto,
  original_price: originalPrice.toFixed(2),
  discounted_price: discountedPrice.toFixed(2)
});
```

**Para Recompra** (busque por "está acabando"):
```typescript
// ANTES
const message = `
Olá ${client.name}!
O produto "${productData.name}" que você comprou está acabando! 🏁
...
`.trim();

// DEPOIS
const message = await getReorderMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: productData.name,
  product_sku: product.sku,
  order_date: new Date(order.order_date).toLocaleDateString('pt-BR'),
  duration_days: durationDays
});
```

### 4.4 Deploy

```bash
npx supabase functions deploy process-order-created
```

---

## 📚 Documentação Completa

Se precisar de mais detalhes, consulte:

- **GUIA_INSTALACAO_TEMPLATES.md** - Guia completo passo a passo
- **COMO_USAR_TEMPLATES.md** - Como usar e personalizar templates
- **AUTOMACOES_MENSAGENS.md** - Como funciona todo o sistema de automação

---

## ❓ Problemas?

### Erro: "relation message_templates does not exist"

**Solução**: Execute o SQL novamente. Certifique-se de usar o arquivo **_CORRIGIDO**.

### Erro: "permission denied"

**Solução**: Verifique se você está logado no workspace correto. RLS está ativo.

### Templates não carregam na interface

**Solução**:
1. Abra o console do navegador (F12)
2. Veja se há erros relacionados a `message_templates`
3. Execute a query de verificação acima

### Edge Functions não usam templates customizados

**Causa**: As funções ainda estão com mensagens hardcoded.

**Solução**: Siga o PASSO 4 para atualizar as Edge Functions.

---

## ✨ Resultado Final

Depois de completar todos os passos, você terá:

✅ Tabela `message_templates` criada no banco
✅ Templates padrão inseridos para todos os workspaces
✅ Interface funcionando em `/message-templates`
✅ Preview em tempo real das mensagens
✅ (Opcional) Edge Functions usando templates do banco

---

## 🚀 Próximos Passos

Após instalar, você pode:

1. **Personalizar mensagens** - Acesse `/message-templates` e edite
2. **Testar com pedidos reais** - Crie um pedido de teste no Baselinker
3. **Ver histórico** - Acesse Jobs & Logs → Histórico Completo
4. **Monitorar execuções** - Veja se as mensagens usam seus templates

---

**Dúvidas?** Consulte a documentação completa ou me chame! 😊
