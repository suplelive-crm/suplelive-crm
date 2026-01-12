# Deploy da Edge Function register-user

## Problema

Erro ao tentar cadastrar novo usuário:
```
POST https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/register-user 404 (Not Found)
```

A Edge Function `register-user` existe no código mas **não foi deployada** no Supabase Cloud.

## Solução: Deploy via Dashboard

### Passo 1: Acessar Supabase Dashboard

1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto: **oqwstanztqdiexgrpdta**
3. No menu lateral, clique em **Edge Functions**

### Passo 2: Criar a função

1. Clique em **"Create a new function"** ou **"New Function"**
2. Nome da função: `register-user`
3. Clique em **Create**

### Passo 3: Copiar o código

Abra o arquivo: [supabase/functions/register-user/index.ts](supabase/functions/register-user/index.ts)

Copie **TODO** o conteúdo (linhas 1-199).

### Passo 4: Colar e Deploy

1. No editor da função no Supabase Dashboard
2. **Apague todo** o código de exemplo
3. **Cole** o código copiado
4. Clique em **Deploy** ou **Save & Deploy**
5. Aguarde confirmação de sucesso

### Passo 5: Testar

1. Faça **hard reload** no navegador (Ctrl+Shift+R)
2. Tente cadastrar um novo usuário novamente
3. Verifique se aparece no console: `✅ Usuário criado com sucesso`

## O que essa função faz

A Edge Function `register-user` permite que **owners de workspace** criem novos usuários com acesso ao sistema:

- Valida permissões (apenas owner pode criar usuários)
- Cria o usuário no Supabase Auth
- Atribui role (admin ou operator)
- Vincula ao workspace
- Auto-confirma o email do novo usuário

## Verificar se o deploy funcionou

Depois do deploy, verifique se a função aparece na lista de Edge Functions:

```
✅ register-user
✅ baselinker-proxy
✅ baselinker-sync
✅ evolution-webhook
... (outras funções)
```

## Se continuar dando erro 404

1. Aguarde 30 segundos após o deploy
2. Limpe o cache do navegador
3. Faça hard reload (Ctrl+Shift+R)
4. Verifique os **Logs** da função no Supabase para ver se há erros de inicialização

## Alternativa: Deploy via CLI (Opcional)

Se preferir usar a CLI do Supabase:

```bash
# Na raiz do projeto
npx supabase functions deploy register-user
```

Mas o deploy via Dashboard é mais simples e visual.

---

**Status**: Aguardando deploy da função `register-user` no Supabase Cloud.
