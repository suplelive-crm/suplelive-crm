# 🚀 Guia de Instalação - Templates de Mensagens

> **Tempo estimado**: 5 minutos
> **Dificuldade**: Fácil

---

## 📋 Checklist de Instalação

- [ ] **Passo 1**: Executar SQL no Supabase
- [ ] **Passo 2**: Verificar se tabela foi criada
- [ ] **Passo 3**: Testar a interface no frontend
- [ ] **Passo 4**: (Opcional) Atualizar Edge Functions

---

## 🗄️ PASSO 1: Executar SQL no Supabase

### Opção A: Via Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
   ```

2. **Abra o SQL Editor**
   - No menu lateral, clique em **"SQL Editor"**
   - Ou vá direto para `/editor`

3. **Cole o script**
   - Abra o arquivo: `EXECUTAR_NO_SUPABASE.sql`
   - **Copie TUDO** (Ctrl+A, Ctrl+C)
   - **Cole** no editor SQL do Supabase

4. **Execute**
   - Clique no botão **"RUN"** (canto inferior direito)
   - Ou pressione **Ctrl+Enter**

5. **Aguarde confirmação**
   - Você deve ver: ✅ **"Success. No rows returned"**
   - Se vir erro, copie a mensagem e me envie

### Opção B: Via CLI (Avançado)

Se você já usa Supabase CLI localmente:

```bash
# 1. Certifique-se que está conectado
npx supabase link

# 2. Execute a migration
npx supabase db push

# 3. Ou execute o arquivo diretamente
npx supabase db execute -f supabase/migrations/20250123_message_templates.sql
```

---

## ✅ PASSO 2: Verificar se Tabela foi Criada

### No Supabase Dashboard:

1. **Acesse Table Editor**
   ```
   https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
   ```

2. **Procure a tabela `message_templates`**
   - No menu lateral esquerdo
   - Deve estar listada junto com outras tabelas

3. **Clique na tabela**
   - Você deve ver 3 registros por workspace
   - Cada workspace tem: welcome, upsell, reorder

### Query de Verificação:

Cole esta query no SQL Editor:

```sql
-- Ver todos os templates criados
SELECT
  w.name as workspace_name,
  mt.template_type,
  mt.is_active,
  mt.created_at
FROM message_templates mt
JOIN workspaces w ON w.id = mt.workspace_id
ORDER BY w.name, mt.template_type;
```

**Resultado esperado:**
```
workspace_name | template_type | is_active | created_at
---------------|---------------|-----------|------------
Meu Workspace  | reorder       | true      | 2025-12-23...
Meu Workspace  | upsell        | true      | 2025-12-23...
Meu Workspace  | welcome       | true      | 2025-12-23...
```

---

## 🎨 PASSO 3: Testar a Interface

### 3.1 - Acesse a Página

1. **Inicie o servidor de desenvolvimento** (se ainda não estiver rodando):
   ```bash
   npm run dev
   ```

2. **Acesse no navegador**:
   ```
   http://localhost:5173/message-templates
   ```

3. **Ou pelo menu**:
   - Faça login no sistema
   - No menu lateral, clique em **"Templates"**

### 3.2 - Teste Cada Aba

**Aba Boas-Vindas:**
1. Clique na aba "Boas-Vindas"
2. Veja o template padrão carregado
3. Veja o preview à direita

**Aba Venda Casada:**
1. Clique na aba "Venda Casada"
2. Edite o texto (ex: adicione um emoji)
3. Veja o preview atualizar em tempo real
4. Clique em "Salvar Template"
5. Veja a mensagem de sucesso

**Aba Recompra:**
1. Clique na aba "Recompra"
2. Altere os "Dados de Exemplo" (nome do cliente)
3. Veja o preview mudar instantaneamente

### 3.3 - Verificar se Salvou

Cole esta query no Supabase SQL Editor:

```sql
-- Ver conteúdo dos templates
SELECT
  template_type,
  LEFT(template_content, 100) as preview,
  updated_at
FROM message_templates
WHERE workspace_id = '[SEU_WORKSPACE_ID]'
ORDER BY template_type;
```

Se você editou e salvou, o `updated_at` deve estar recente.

---

## 🔧 PASSO 4: Atualizar Edge Functions (Opcional)

> ⚠️ **Este passo é opcional**. O sistema já funciona com os templates padrão hardcoded.
> Se você quiser que as Edge Functions **busquem os templates do banco**, siga abaixo.

### 4.1 - Arquivo Helper Já Foi Criado

O arquivo `supabase/functions/_shared/message-templates.ts` já está pronto.

### 4.2 - Atualizar `process-order-created`

**Antes** (hardcoded):
```typescript
// Linha ~316 em process-order-created/index.ts
const message = `
Olá ${client.name}! 👋
Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.
Qualquer dúvida, estou à disposição! 😊
`.trim();
```

**Depois** (usando templates do banco):
```typescript
// Adicionar import no topo do arquivo
import { getWelcomeMessage } from '../_shared/message-templates.ts';

// Substituir na linha ~316
const message = await getWelcomeMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base?.toString() || ''
});
```

### 4.3 - Atualizar Mensagem de Upsell

**Antes** (hardcoded):
```typescript
// Linha ~382 em process-order-created/index.ts
const message = `
Olá ${client.name}! 🎉
Obrigado pelo seu pedido!
Clientes que compraram os mesmos produtos também gostaram de:
${productList}
Quer aproveitar? Posso adicionar ao seu pedido! 😊
`.trim();
```

**Depois** (usando templates):
```typescript
// Adicionar import no topo
import { getUpsellMessage } from '../_shared/message-templates.ts';

// Substituir na linha ~382
const message = await getUpsellMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base?.toString() || '',
  product_list: productList,
  order_total: `R$ ${order.total_amount?.toFixed(2) || '0.00'}`
});
```

### 4.4 - Atualizar Mensagem de Recompra

**Antes** (hardcoded):
```typescript
// Linha ~451 em process-order-created/index.ts
const message = `
Olá ${client.name}!
O produto "${productData.name}" que você comprou está acabando! 🏁
Quer fazer uma nova compra para não ficar sem? 🛒
É só me chamar! 😊
`.trim();
```

**Depois** (usando templates):
```typescript
// Adicionar import no topo
import { getReorderMessage } from '../_shared/message-templates.ts';

// Substituir na linha ~451
const message = await getReorderMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: productData.name,
  product_sku: product.sku,
  order_date: new Date(order.order_date).toLocaleDateString('pt-BR'),
  duration_days: durationDays
});
```

### 4.5 - Deploy das Edge Functions

Após fazer as alterações:

```bash
# Deploy de todas as funções
npx supabase functions deploy

# Ou apenas a que foi alterada
npx supabase functions deploy process-order-created
```

---

## 🧪 Testando Tudo Junto

### Teste 1: Criar Pedido Manualmente

1. Crie um pedido de teste no Baselinker
2. Aguarde o processamento (30s - 1min)
3. Verifique se a mensagem foi enviada
4. A mensagem deve usar o template personalizado (se você editou)

### Teste 2: Verificar Logs

No Supabase Dashboard → Functions → Logs:

```
Buscando template welcome para workspace [ID]
Template encontrado: Olá {{client_name}}! 👋...
Mensagem enviada: Olá João Silva! 👋...
```

Se você vir "usando default" em vez de "encontrado", significa que:
- A tabela não foi criada corretamente, OU
- O workspace_id está diferente

---

## ❓ Troubleshooting

### Erro: "relation message_templates does not exist"

**Causa**: Tabela não foi criada

**Solução**:
1. Execute o script SQL novamente
2. Verifique se você está no projeto correto do Supabase

---

### Erro: "permission denied for table message_templates"

**Causa**: RLS não configurado corretamente

**Solução**:
1. Execute a parte de RLS Policies do script novamente
2. Ou desative RLS temporariamente (não recomendado em produção):
   ```sql
   ALTER TABLE message_templates DISABLE ROW LEVEL SECURITY;
   ```

---

### Templates não carregam na interface

**Causa**: Workspace ID não encontrado ou RLS bloqueando

**Solução**:
1. Abra o console do navegador (F12)
2. Veja se há erros relacionados a `message_templates`
3. Verifique se você está logado no workspace correto

**Query de debug**:
```sql
-- Ver se o usuário atual tem acesso
SELECT * FROM message_templates
WHERE workspace_id IN (
  SELECT workspace_id
  FROM workspace_users
  WHERE user_id = auth.uid()
);
```

---

### Mensagens não usam template personalizado

**Causa**: Edge Functions ainda estão usando código hardcoded

**Solução**:
1. Siga o **PASSO 4** para atualizar as Edge Functions
2. Faça deploy das funções
3. Teste com novo pedido

---

## 📊 Verificações Finais

Execute estas queries para garantir que tudo está OK:

### 1. Contar templates por workspace
```sql
SELECT
  w.name,
  COUNT(*) as total_templates
FROM message_templates mt
JOIN workspaces w ON w.id = mt.workspace_id
GROUP BY w.name;
```

**Esperado**: 3 templates por workspace

### 2. Ver templates ativos
```sql
SELECT
  template_type,
  is_active,
  array_length(variables, 1) as num_variables
FROM message_templates
WHERE workspace_id = '[SEU_WORKSPACE_ID]';
```

**Esperado**:
```
template_type | is_active | num_variables
--------------|-----------|---------------
welcome       | true      | 2
upsell        | true      | 4
reorder       | true      | 5
```

### 3. Testar função de substituição
```sql
SELECT replace_template_variables(
  'Olá {{name}}, seu pedido {{order}} foi criado!',
  '{"name": "João", "order": "12345"}'::jsonb
);
```

**Esperado**: `Olá João, seu pedido 12345 foi criado!`

---

## 🎉 Parabéns!

Se você chegou até aqui e todos os testes passaram, o sistema de templates está funcionando!

### O que você pode fazer agora:

✅ Personalizar as mensagens no menu "Templates"
✅ Ver preview em tempo real
✅ Testar diferentes cenários
✅ (Opcional) Atualizar Edge Functions para usar templates do banco

---

## 📚 Documentação Adicional

- **Como usar**: `COMO_USAR_TEMPLATES.md`
- **Arquitetura geral**: `AUTOMACOES_MENSAGENS.md`
- **Código frontend**: `src/components/automation/MessageTemplatesConfig.tsx`
- **Helper functions**: `supabase/functions/_shared/message-templates.ts`

---

## 🆘 Precisa de Ajuda?

Se algo não funcionou:
1. Copie a mensagem de erro
2. Anote em qual passo você está
3. Me envie as informações

**Informações úteis para debug:**
- Versão do Supabase CLI: `npx supabase --version`
- Project ID do Supabase
- Mensagem de erro completa
- Screenshot (se for erro visual)
