# 🔧 Corrigir Erro de Schema Cache (Relacionamentos)

**Data**: 08/01/2026
**Status**: ⚠️ EXECUTAR AGORA

---

## ❌ Problema

Após executar a migration principal, ainda aparecem erros:

```
Could not find a relationship between 'workspace_users' and 'user_id' in the schema cache
Could not find a relationship between 'user_invitations' and 'invited_by' in the schema cache
```

**Causa**: O PostgREST do Supabase não reconhece automaticamente relacionamentos com `auth.users` (schema diferente).

**Solução**: Criar funções RPC que fazem o JOIN manualmente.

---

## 🚀 Solução Implementada

### O Que Foi Feito:

1. ✅ **Criada migration com funções RPC**:
   - `get_workspace_users_with_details(workspace_id)` - Busca workspace_users com email e nome do auth.users
   - `get_user_invitations_with_details(workspace_id)` - Busca user_invitations com dados de quem convidou

2. ✅ **Atualizado workspaceStore.ts**:
   - `fetchWorkspaceUsers()` agora usa RPC em vez de JOIN direto
   - `fetchUserInvitations()` agora usa RPC em vez de JOIN direto

---

## 📋 Como Aplicar a Correção

### **Passo 1: Executar Migration RPC** ⚠️ OBRIGATÓRIO

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. SQL Editor → New Query
3. Copie **TODO** o conteúdo de:
   ```
   supabase/migrations/20260108_create_get_workspace_users_with_details.sql
   ```
4. Cole e clique em **"Run"**
5. Aguarde mensagem de sucesso:
   ```
   ✅ FUNÇÕES RPC CRIADAS COM SUCESSO!
   Funções disponíveis:
     - get_workspace_users_with_details(workspace_id)
     - get_user_invitations_with_details(workspace_id)
   ```

### **Passo 2: Recarregar Aplicação**

1. **Pare o servidor** (Ctrl+C no terminal)
2. **Inicie novamente**:
   ```bash
   npm run dev
   ```
3. **Recarregue o navegador** (F5)

---

## ✅ Verificar se Funcionou

Após executar a migration e recarregar:

1. **Erros devem desaparecer** do console
2. Login deve funcionar normalmente
3. Vá em: **Configurações → Workspace → Gerenciar Usuários**
4. Deve abrir sem erros
5. Lista de membros deve carregar

---

## 🔍 Como Funciona

### Antes (❌ ERRO):
```typescript
// Tentava fazer JOIN direto (não funciona com auth.users)
supabase
  .from('workspace_users')
  .select(`
    *,
    user:user_id (email, user_metadata)  // ❌ Erro de schema cache
  `)
```

### Depois (✅ FUNCIONA):
```typescript
// Usa RPC com SECURITY DEFINER (pode acessar auth.users)
supabase.rpc('get_workspace_users_with_details', {
  p_workspace_id: workspace.id
})

// Retorna:
// {
//   id, workspace_id, user_id, role, status, ...
//   user_email: "user@example.com",
//   user_name: "João Silva"
// }
```

---

## 📊 O Que as Funções RPC Fazem

### `get_workspace_users_with_details(workspace_id)`

**Entrada**: UUID do workspace

**Saída**: Lista de workspace_users com:
- Todos os campos de `workspace_users`
- `user_email`: Email do auth.users
- `user_name`: Nome do auth.users (ou email se nome não existir)

**SQL Interno**:
```sql
SELECT
  wu.*,
  au.email as user_email,
  COALESCE(au.raw_user_meta_data->>'name', au.email) as user_name
FROM workspace_users wu
INNER JOIN auth.users au ON wu.user_id = au.id
WHERE wu.workspace_id = p_workspace_id
```

### `get_user_invitations_with_details(workspace_id)`

**Entrada**: UUID do workspace

**Saída**: Lista de user_invitations com:
- Todos os campos de `user_invitations`
- `invited_by_email`: Email de quem convidou
- `invited_by_name`: Nome de quem convidou

---

## ⚠️ Importante

### Por Que JOIN Direto Não Funciona?

- `workspace_users` está no schema `public`
- `auth.users` está no schema `auth`
- PostgREST não reconhece automaticamente foreign keys entre schemas diferentes
- Funções RPC com `SECURITY DEFINER` podem acessar ambos os schemas

### Vantagens da Solução RPC:

1. ✅ Funciona sempre (não depende de schema cache)
2. ✅ Melhor performance (JOIN no banco, não no frontend)
3. ✅ Mais seguro (SECURITY DEFINER controlado)
4. ✅ Retorna apenas dados necessários

---

## 🔧 Troubleshooting

### Erro: "function get_workspace_users_with_details does not exist"
**Solução**: Verifique se executou a migration RPC no SQL Editor do Supabase.

### Erro persiste após migration
**Solução**:
1. Pare o servidor dev (Ctrl+C)
2. Limpe cache do navegador (Ctrl+Shift+Delete)
3. Reinicie servidor: `npm run dev`
4. Abra navegador em aba anônima
5. Faça login novamente

### Como verificar se funções existem?
Execute no SQL Editor:
```sql
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'get_%_with_details'
ORDER BY routine_name;
```

Deve retornar:
```
get_user_invitations_with_details | FUNCTION
get_workspace_users_with_details  | FUNCTION
```

---

## 📂 Arquivos Envolvidos

**Migration**:
- [supabase/migrations/20260108_create_get_workspace_users_with_details.sql](supabase/migrations/20260108_create_get_workspace_users_with_details.sql)

**Frontend Atualizado**:
- [src/store/workspaceStore.ts:186-260](src/store/workspaceStore.ts#L186) - fetch functions usando RPC

---

## ✅ Checklist

- [ ] Migration RPC executada no Supabase
- [ ] Mensagens de sucesso apareceram
- [ ] Servidor dev reiniciado
- [ ] Navegador recarregado (F5)
- [ ] Erros de schema cache desapareceram
- [ ] Login funcionando
- [ ] "Gerenciar Usuários" abre sem erro

---

**Criado por**: Claude Code
**Prioridade**: 🔴 URGENTE - Execute agora
**Status**: ⚠️ Aguardando execução da migration RPC
