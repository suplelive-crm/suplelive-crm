# ✅ Webhook Baselinker - Deploy Completo

## 🎉 Status: DEPLOYADO COM SUCESSO

O webhook do Baselinker foi deployado com sucesso no Supabase!

**Data do Deploy:** 2025-11-13
**Função:** baselinker-webhook
**Status:** ✅ Ativo

---

## 📍 URL do Webhook

```
https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-webhook
```

---

## ⚠️ AÇÃO NECESSÁRIA: Configurar Permissões

Antes de usar o webhook, você PRECISA configurar as permissões no Supabase Dashboard:

### Passo a Passo:

1. **Acesse o Dashboard do Supabase:**
   - URL: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
   - Faça login com sua conta

2. **Selecione a Função:**
   - Clique na função **baselinker-webhook** na lista

3. **Configure as Permissões:**
   - Vá na aba **Settings** (Configurações)
   - Procure por **"Verify JWT"** ou **"JWT Verification"**
   - **DESMARQUE** esta opção (ou configure como `false`)
   - Clique em **Save** (Salvar)

4. **Teste o Webhook:**
   Após desmarcar "Verify JWT", teste com este comando:
   ```bash
   curl -X POST https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-webhook \
     -H "Content-Type: application/json" \
     -H "x-workspace-id: SEU_WORKSPACE_ID" \
     -d '{"event":"order_status_changed","order_id":"12345","status_id":"paid"}'
   ```

   **Resposta Esperada:**
   ```json
   {"success":true,"message":"Event order_status_changed processed"}
   ```

---

## 🎯 Como Configurar no Baselinker

### Interface do Usuário

As instruções completas estão agora disponíveis **diretamente na plataforma**:

1. Acesse a página **Integrações** na sua plataforma
2. Role até a seção **"Configuração do Baselinker"**
3. Você verá o card **"Webhook do Baselinker"** com:
   - ✅ URL do webhook (com botão de copiar)
   - ✅ Workspace ID (com botão de copiar)
   - ✅ Lista de eventos recomendados
   - ✅ Instruções passo a passo
   - ✅ Link direto para o painel do Baselinker

### Configuração Manual no Baselinker

Se preferir configurar manualmente:

1. **Acesse:** https://panel.baselinker.com/
2. **Navegue:** Configurações → API → Webhooks
3. **Clique:** "Adicionar webhook"

**Configuração:**
- **URL:** `https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-webhook`
- **Método:** `POST`
- **Header Personalizado:**
  - Nome: `x-workspace-id`
  - Valor: `[SEU_WORKSPACE_ID]` (copie da interface)

**Eventos para Monitorar:**
- ✅ `order_status_changed` - Mudança de status do pedido
- ✅ `new_order` - Novo pedido criado
- ✅ `order_updated` - Pedido atualizado

4. **Salvar e Testar:**
   - Clique em **"Salvar"**
   - Use o botão **"Testar webhook"** do Baselinker

---

## 🔧 O Que o Webhook Faz

### Eventos Processados:

#### 1. **order_status_changed**
- **O que faz:** Atualiza o status do pedido na plataforma
- **Quando:** Status do pedido muda no Baselinker (pago, enviado, cancelado, etc.)
- **Resultado:** Status atualizado imediatamente no CRM

#### 2. **new_order**
- **O que faz:** Registra que há um novo pedido
- **Quando:** Novo pedido é criado no Baselinker
- **Resultado:** Log do evento (pedido será sincronizado no próximo ciclo)

#### 3. **order_updated**
- **O que faz:** Atualiza dados do pedido (preço, etc.)
- **Quando:** Informações do pedido são alteradas
- **Resultado:** Dados atualizados na plataforma

### Mapeamento de Status:

O webhook converte os status do Baselinker para os status da plataforma:

- `paid`, `ready_for_shipping` → **processing**
- `shipped`, `delivered` → **completed**
- `cancelled`, `returned` → **cancelled**
- Outros → **pending**

---

## 🔐 Segurança

### Header Obrigatório

O webhook **EXIGE** o header `x-workspace-id` para identificar qual workspace processar:

```http
POST /functions/v1/baselinker-webhook
x-workspace-id: abc123-def456-ghi789
Content-Type: application/json
```

**Sem este header, o webhook retornará erro 400.**

### Validações

O webhook valida:
- ✅ Presença de `event` e `order_id` no payload
- ✅ Existência do workspace
- ✅ Formato dos dados
- ✅ Existência do pedido no banco (para atualizações)

---

## 📊 Monitoramento

### Ver Logs do Webhook

Para ver logs em tempo real:

```bash
npx supabase functions logs baselinker-webhook --tail
```

Ou acesse:
- **Dashboard:** https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
- **Função:** baselinker-webhook
- **Aba:** Logs

### SQL para Verificar Atualizações

```sql
-- Ver últimas atualizações de pedidos
SELECT
  order_id_base,
  status,
  updated_at,
  created_at
FROM orders
ORDER BY updated_at DESC
LIMIT 10;

-- Ver pedidos atualizados recentemente (webhook)
SELECT
  order_id_base,
  status,
  updated_at
FROM orders
WHERE updated_at > created_at + INTERVAL '5 minutes'
ORDER BY updated_at DESC;
```

---

## 🔄 Sistema Híbrido

O sistema usa uma **abordagem híbrida** para máxima confiabilidade:

### Webhook (Tempo Real)
- **Quando:** Evento ocorre no Baselinker
- **O que:** Atualiza status de pedidos existentes
- **Vantagem:** Instantâneo (segundos)

### Sincronização Incremental (Backup)
- **Quando:** Manual ou periódico (1x/hora recomendado)
- **O que:** Busca novos pedidos desde o último `order_date`
- **Vantagem:** Garante que nada seja perdido

**Função de Sync:** `baselinkerStore.syncOrders()`

---

## 🐛 Troubleshooting

### Problema: Webhook retorna 401 (Unauthorized)

**Causa:** JWT Verification está ativado
**Solução:** Desmarque "Verify JWT" no Dashboard do Supabase (ver Passo a Passo acima)

### Problema: Webhook retorna 400 (Missing workspace_id)

**Causa:** Header `x-workspace-id` não configurado
**Solução:** Configure o header no painel do Baselinker

### Problema: Pedidos não estão atualizando

**Causa:** Pedido não existe no banco de dados
**Solução:**
1. Execute sincronização manual primeiro
2. Verifique o `workspace_id` correto
3. Verifique logs do webhook

### Problema: Como obter o Workspace ID?

**Solução 1:** Via Interface
- Acesse Integrações → Configuração do Baselinker → Webhook
- O Workspace ID aparece com botão de copiar

**Solução 2:** Via SQL
```sql
SELECT id, name FROM workspaces;
```

---

## 📝 Próximos Passos

1. ✅ **Deploy da Função** - COMPLETO
2. ⏳ **Configurar Permissões no Supabase** - VOCÊ PRECISA FAZER
3. ⏳ **Testar Webhook** - Após configurar permissões
4. ⏳ **Configurar no Baselinker** - Usar interface da plataforma
5. ⏳ **Testar Eventos Reais** - Criar pedido teste no Baselinker

---

## 📚 Documentação Adicional

- **Instruções Completas:** [BASELINKER_WEBHOOK_SETUP.md](BASELINKER_WEBHOOK_SETUP.md)
- **Dashboard do Supabase:** https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
- **Documentação Baselinker Webhooks:** https://api.baselinker.com/index.php?method=webhooks
- **Código da Função:** [supabase/functions/baselinker-webhook/index.ts](supabase/functions/baselinker-webhook/index.ts)

---

## ✨ Resumo

- ✅ Webhook deployado com sucesso
- ✅ Interface de configuração criada na plataforma
- ✅ Documentação completa disponível
- ⏳ Aguardando configuração de permissões no Supabase
- ⏳ Aguardando configuração no Baselinker

**Próxima ação:** Configure as permissões no Supabase Dashboard (5 minutos)

---

**Última atualização:** 2025-11-13
**Autor:** Claude Code
**Versão:** 1.0.0
