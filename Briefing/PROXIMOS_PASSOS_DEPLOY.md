# 🚀 Próximos Passos - Deploy das Edge Functions

**Status atual**: ✅ Supabase CLI instalado com sucesso (v2.54.11)

---

## Passo 1: Obter Access Token do Supabase

1. Acesse: https://supabase.com/dashboard/account/tokens
2. Clique no botão **"Generate new token"**
3. Dê um nome para o token (ex: "CLI Deploy" ou "Desenvolvimento")
4. Clique em **"Generate token"**
5. **Copie o token gerado** (começa com `sbp_...`)
6. ⚠️ **IMPORTANTE**: Guarde esse token em local seguro - ele só aparece uma vez!

---

## Passo 2: Fazer Login no Supabase CLI

Abra o PowerShell e execute **um dos comandos abaixo** (substitua `SEU_TOKEN` pelo token que você copiou):

### Opção 1: Login direto com token
```powershell
npx supabase login --token SEU_TOKEN_AQUI
```

**Exemplo**:
```powershell
npx supabase login --token sbp_abc123def456...
```

### Opção 2: Definir variável de ambiente primeiro
```powershell
$env:SUPABASE_ACCESS_TOKEN="SEU_TOKEN_AQUI"
npx supabase login
```

**Resultado esperado**: Deve aparecer algo como:
```
Logged in!
```

---

## Passo 3: Linkar ao Projeto

Execute este comando (substitua `SEU_PROJECT_REF` pela referência do seu projeto):

```powershell
npx supabase link --project-ref SEU_PROJECT_REF
```

### Como pegar o Project Ref:

1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto
3. Clique em **"Project Settings"** (ícone de engrenagem)
4. Em **"General"** → **"Reference ID"**, copie o ID
   - Ou pegue da URL do Dashboard: `https://supabase.com/dashboard/project/ABC123` → o `ABC123` é o project-ref

**Para este projeto** (baseado nas leituras anteriores):
```powershell
npx supabase link --project-ref oqwstanztqdiexgrpdta
```

**Resultado esperado**:
```
Linked to project oqwstanztqdiexgrpdta
```

---

## Passo 4: Deploy das Edge Functions

Execute estes comandos **um por vez** (ou todos de uma vez):

### Deploy individual (recomendado para ver progresso):

```powershell
# Função 1: Poller de eventos do Baselinker (roda a cada 1 min)
npx supabase functions deploy baselinker-event-poller

# Função 2: Processa pedidos novos
npx supabase functions deploy process-order-created

# Função 3: Envia mensagens agendadas
npx supabase functions deploy send-scheduled-messages

# Função 4: Atualiza estoque no Baselinker
npx supabase functions deploy update-baselinker-stock

# Função 5: Roteador de eventos (trigger do banco)
npx supabase functions deploy process-event
```

### Deploy de todas de uma vez:

```powershell
npx supabase functions deploy baselinker-event-poller && npx supabase functions deploy process-order-created && npx supabase functions deploy send-scheduled-messages && npx supabase functions deploy update-baselinker-stock && npx supabase functions deploy process-event
```

**Resultado esperado para cada função**:
```
Deploying function baselinker-event-poller...
Function deployed successfully!
Version: 1
```

---

## Passo 5: Verificar Deploy no Dashboard

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
2. Você deve ver **5 funções** listadas:
   - ✅ baselinker-event-poller
   - ✅ process-order-created
   - ✅ send-scheduled-messages
   - ✅ update-baselinker-stock
   - ✅ process-event

3. Clique em cada uma para ver detalhes e logs

---

## Possíveis Erros e Soluções

### Erro: "Not logged in"
**Solução**: Execute novamente o Passo 2 (login)

### Erro: "Project not linked"
**Solução**: Execute novamente o Passo 3 (link)

### Erro: "Function not found in supabase/functions/"
**Causa**: Você está no diretório errado
**Solução**:
```powershell
cd c:\Users\paull\Documents\GitHub\suplelive-crm
npx supabase functions deploy [nome-da-funcao]
```

### Erro: "Missing dependency @supabase/supabase-js"
**Causa**: A função usa dependências que não estão no projeto
**Solução**: As Edge Functions já têm acesso a essas dependências - ignore o warning se o deploy completar

---

## Após Deploy Bem-Sucedido

Continue para os próximos passos do guia:
- [GUIA_COMPLETO_SUPABASE.md - Passo 6: Configurar Cron Jobs](./GUIA_COMPLETO_SUPABASE.md#passo-6-configurar-cron-jobs)
- [GUIA_COMPLETO_SUPABASE.md - Passo 7: Testar o Sistema](./GUIA_COMPLETO_SUPABASE.md#passo-7-testar-o-sistema)

---

## Checklist de Progresso

- [ ] Access token gerado no Dashboard
- [ ] Login no Supabase CLI realizado
- [ ] Projeto linkado ao CLI
- [ ] Função `baselinker-event-poller` deployada
- [ ] Função `process-order-created` deployada
- [ ] Função `send-scheduled-messages` deployada
- [ ] Função `update-baselinker-stock` deployada
- [ ] Função `process-event` deployada
- [ ] Verificado no Dashboard que as 5 funções aparecem

---

**Última atualização**: 2025-01-08
**Status**: Aguardando login do usuário
