# 📋 Executar Migration de Gerenciamento de Usuários

**Data**: 08/01/2026
**Arquivo**: `supabase/migrations/20260108_create_workspace_users_tables.sql`

---

## 🎯 O Que Esta Migration Faz

Esta migration cria as tabelas necessárias para que **administradores** possam:
- ✅ Cadastrar novos usuários diretamente para o workspace
- ✅ Convidar usuários por email
- ✅ Gerenciar roles (Admin/Operator)
- ✅ Remover usuários do workspace
- ✅ Alterar permissões de usuários

---

## 📋 Passos para Executar

### **Passo 1: Acessar o SQL Editor do Supabase**

1. Abra: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. No menu lateral, clique em **"SQL Editor"**
3. Clique em **"New Query"** (botão verde no canto superior direito)

---

### **Passo 2: Copiar o SQL da Migration**

1. Abra o arquivo: `supabase/migrations/20260108_create_workspace_users_tables.sql`
2. **Copie TODO o conteúdo** do arquivo (Ctrl+A, Ctrl+C)
3. **Cole no SQL Editor** do Supabase (Ctrl+V)

---

### **Passo 3: Executar a Migration**

1. Clique no botão **"Run"** (ou pressione Ctrl+Enter)
2. Aguarde a execução (pode levar 5-10 segundos)
3. Você verá mensagens de sucesso no console:

```
========================================
MIGRATION APLICADA COM SUCESSO!
========================================

Tabelas criadas:
1. workspace_users: ✓ OK
2. user_invitations: ✓ OK

Dados migrados:
- Total de workspaces: X
- Owners adicionados como admins: X

Funcionalidades habilitadas:
✓ Cadastro de usuários por Admin/Owner
✓ Convites de usuários (via email)
✓ Gerenciamento de roles (admin/operator)
✓ Row Level Security configurado
```

---

## ✅ Verificar se Funcionou

Após executar a migration, execute este SQL para verificar:

\`\`\`sql
-- Verificar se as tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('workspace_users', 'user_invitations');

-- Ver owners adicionados
SELECT * FROM workspace_users;
\`\`\`

**Resultado esperado:**
- Deve retornar 2 linhas: `workspace_users` e `user_invitations`
- Deve mostrar os owners existentes adicionados como admins

---

## 🚀 Próximo Passo: Deploy da Edge Function

Após a migration estar aplicada, execute:

\`\`\`bash
npx supabase functions deploy register-user
\`\`\`

Isso vai fazer o deploy da Edge Function que permite:
- Criar usuários diretamente via Admin API
- Auto-confirmar email dos usuários criados
- Associar usuários ao workspace automaticamente

---

## 🔍 Troubleshooting

### Erro: "relation already exists"
**Solução**: As tabelas já existem. Pode prosseguir para o deploy da Edge Function.

### Erro: "permission denied"
**Solução**: Certifique-se de estar logado como Owner do projeto Supabase.

### Erro: "syntax error"
**Solução**: Certifique-se de copiar TODO o conteúdo do arquivo SQL, incluindo os comentários.

---

## 📊 O Que Foi Criado

### Tabela `workspace_users`
Armazena membros de workspaces com seus roles:
- `id` - ID único do registro
- `workspace_id` - Workspace ao qual pertence
- `user_id` - ID do usuário (auth.users)
- `role` - 'admin' ou 'operator'
- `status` - 'active', 'pending' ou 'inactive'
- `joined_at` - Data de entrada no workspace

### Tabela `user_invitations`
Armazena convites pendentes:
- `id` - ID único do convite
- `workspace_id` - Workspace que está convidando
- `email` - Email do convidado
- `role` - 'admin' ou 'operator'
- `token` - Token único para aceitar convite
- `expires_at` - Data de expiração (7 dias)
- `status` - 'pending', 'accepted', 'expired' ou 'cancelled'

### Funções Criadas
- `is_workspace_admin()` - Verifica se usuário é admin
- `mark_expired_invitations()` - Marca convites expirados

### Policies (RLS)
- Usuários só veem membros de workspaces que pertencem
- Apenas Owners e Admins podem gerenciar usuários
- Apenas Owners e Admins podem enviar convites

---

## 🎉 Depois de Aplicar

Você poderá:

1. **Ir para Configurações** no app
2. **Clicar em "Workspace"**
3. **Clicar em "Gerenciar Usuários"**
4. **Escolher entre:**
   - **"Cadastrar Usuário"** - Criar conta e senha diretamente
   - **"Convidar Usuário"** - Enviar convite por email (futuramente)

---

**Criado por**: Claude Code (Anthropic)
**Data**: 08/01/2026
