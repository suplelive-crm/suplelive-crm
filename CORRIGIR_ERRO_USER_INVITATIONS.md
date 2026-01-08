# Correção do Erro: user_invitations RPC Function

## 🔴 Problema Identificado

O console está mostrando o seguinte erro:

```
POST https://oqwstanztqdiexgrpdta.supabase.co/rest/v1/rpc/get_user_invitations_with_details 400 (Bad Request)

Error details:
{
  code: '42703',
  details: null,
  hint: 'Perhaps you meant to reference the column "au.updated_at".',
  message: 'column ui.updated_at does not exist'
}
```

### Causa Raiz

A função RPC `get_user_invitations_with_details` está tentando retornar o campo `updated_at`, mas a tabela `user_invitations` **NÃO possui essa coluna**.

Comparando com as tabelas:
- ✅ `workspace_users` - TEM o campo `updated_at`
- ❌ `user_invitations` - NÃO TEM o campo `updated_at`

---

## ✅ Solução

Foi criada uma migration para corrigir a função RPC removendo a referência ao campo inexistente.

### Arquivo Criado

```
supabase/migrations/20260108_fix_user_invitations_rpc.sql
```

---

## 📋 Como Aplicar a Correção

### **Opção 1: Via Supabase Dashboard (RECOMENDADO)**

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto: **SupleLive CRM**
3. Vá em **SQL Editor** no menu lateral
4. Clique em **"New Query"**
5. Copie **TODO** o conteúdo do arquivo:
   ```
   supabase/migrations/20260108_fix_user_invitations_rpc.sql
   ```
6. Cole no editor SQL
7. Clique em **"Run"**
8. Aguarde a mensagem de sucesso:
   ```
   ✅ FUNÇÃO RPC CORRIGIDA COM SUCESSO!
   ```

### **Opção 2: Via Supabase CLI** (se estiver usando localmente)

```bash
npx supabase db push
```

---

## 🧪 Como Testar

Após aplicar a migration:

1. **Recarregue a aplicação** no navegador (Ctrl+Shift+R ou Cmd+Shift+R)
2. Acesse a página de **Gerenciamento de Usuários**
3. Verifique se o erro desapareceu do console
4. Teste convidar um novo usuário

---

## 📊 O Que Foi Alterado

### Antes (❌ Com Erro)

A função retornava 11 campos, incluindo `updated_at`:

```sql
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  role TEXT,
  invited_by UUID,
  token TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,        -- ❌ Este campo não existe!
  invited_by_email TEXT,
  invited_by_name TEXT
)
```

### Depois (✅ Corrigido)

A função agora retorna 10 campos, sem `updated_at`:

```sql
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  role TEXT,
  invited_by UUID,
  token TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ,
  invited_by_email TEXT,
  invited_by_name TEXT
)
```

---

## ✅ Verificação Final

Após aplicar a correção, execute no SQL Editor do Supabase:

```sql
-- Verificar se a função foi atualizada corretamente
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'get_user_invitations_with_details'
ORDER BY routine_name;
```

Deve retornar:
```
get_user_invitations_with_details | FUNCTION
```

E agora você pode testar chamando a função:

```sql
-- Testar a função (substitua pelo UUID do seu workspace)
SELECT * FROM get_user_invitations_with_details('seu-workspace-id-aqui');
```

---

## 📝 Nota Importante

O tipo TypeScript `UserInvitation` em [src/types/index.ts](src/types/index.ts) já está correto - ele **não inclui** `updated_at`, então não é necessário alterar nada no frontend.

---

## 🎯 Status

- ✅ Migration criada
- ⏳ **Aguardando execução no Supabase Dashboard**
- ⏳ Teste após execução

---

## 🆘 Se o Erro Persistir

1. Verifique se a migration foi executada com sucesso
2. Tente fazer um **Hard Reload** no navegador (Ctrl+Shift+R)
3. Verifique o console do navegador para novos erros
4. Se necessário, execute:
   ```sql
   -- Forçar recriação da função
   DROP FUNCTION IF EXISTS get_user_invitations_with_details(UUID);
   ```
   E então execute a migration novamente.
