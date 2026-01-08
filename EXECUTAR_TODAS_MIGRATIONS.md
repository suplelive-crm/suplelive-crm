# 🚀 Executar Todas as Migrations Pendentes

**Data**: 08/01/2026
**Status**: ⚠️ EXECUTAR AGORA

---

## ❌ Erros Atuais

Você está vendo estes erros:

```
Erro: Could not find a relationship between 'workspace_users' and 'user_id' in the schema cache
Erro: Could not find a relationship between 'user_invitations' and 'invited_by' in the schema cache
```

**Causa**: As tabelas `workspace_users` e `user_invitations` não existem no banco de dados ainda.

**Solução**: Executar as 2 migrations pendentes.

---

## 📋 Migrations Pendentes

### 1. ✅ Criar Tabelas de Usuários
**Arquivo**: `supabase/migrations/20260108_create_workspace_users_tables.sql`
**Cria**:
- Tabela `workspace_users`
- Tabela `user_invitations`
- Índices de performance
- Triggers de updated_at

### 2. ✅ Corrigir Políticas RLS
**Arquivo**: `supabase/migrations/20260108_fix_rls_policies.sql`
**Faz**:
- Remove políticas com recursão infinita
- Cria políticas simplificadas (apenas owners)
- Evita erro "infinite recursion detected"

---

## 🎯 Como Executar (Passo a Passo)

### **Passo 1: Acessar Supabase Dashboard**

1. Abra: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. Login se necessário
3. No menu lateral esquerdo, clique em **"SQL Editor"**

---

### **Passo 2: Executar Migration 1 - Criar Tabelas**

1. No SQL Editor, clique em **"New Query"**
2. Copie **TODO** o conteúdo do arquivo:
   ```
   supabase/migrations/20260108_create_workspace_users_tables.sql
   ```
3. Cole no editor SQL
4. Clique no botão **"Run"** (ou pressione Ctrl+Enter)
5. **Aguarde mensagem de sucesso**

#### Resultado esperado:
```
✓ CREATE TABLE workspace_users
✓ CREATE TABLE user_invitations
✓ CREATE INDEX (6 indexes criados)
✓ CREATE POLICY (8 policies criadas)
✓ CREATE TRIGGER (2 triggers criados)
```

---

### **Passo 3: Executar Migration 2 - Corrigir RLS**

1. No SQL Editor, clique em **"New Query"** novamente
2. Copie **TODO** o conteúdo do arquivo:
   ```
   supabase/migrations/20260108_fix_rls_policies.sql
   ```
3. Cole no editor SQL
4. Clique no botão **"Run"**
5. **Aguarde mensagens de sucesso**

#### Resultado esperado:
```
NOTICE: ========================================
NOTICE: POLÍTICAS RLS CORRIGIDAS!
NOTICE: ========================================
NOTICE:
NOTICE: Políticas removidas (com recursão):
NOTICE: - Users can view workspace members they belong to
NOTICE: - Workspace admins can manage members
NOTICE: - Users can view workspace invitations
NOTICE: - Workspace admins can manage invitations
NOTICE:
NOTICE: Políticas criadas (simplificadas):
NOTICE: ✓ workspace_users: 4 políticas
NOTICE:   - SELECT, INSERT, UPDATE, DELETE
NOTICE: ✓ user_invitations: 4 políticas
NOTICE:   - SELECT, INSERT, UPDATE, DELETE
```

---

## ✅ Verificar se Funcionou

Após executar as duas migrations:

1. **Recarregue a página** do seu app (F5)
2. Os erros devem **desaparecer**
3. Faça login normalmente
4. Vá em: **Configurações → Workspace → Gerenciar Usuários**
5. Deve aparecer:
   - Lista de membros do workspace
   - Botão "Cadastrar Usuário"
   - **SEM erros de schema**

---

## 🔍 Troubleshooting

### Erro: "relation 'workspace_users' already exists"
**Solução**: Tabela já existe! Pode pular a Migration 1 e executar apenas a Migration 2.

### Erro: "syntax error at or near..."
**Solução**:
1. Verifique se copiou **TODO** o arquivo
2. Não copie apenas parte do SQL
3. Copie desde a primeira linha até a última

### Erros ainda aparecem após executar
**Solução**:
1. Limpe cache do navegador (Ctrl+Shift+Delete)
2. Faça logout e login novamente
3. Feche e abra o navegador novamente

### Como verificar se tabelas foram criadas?
Execute no SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('workspace_users', 'user_invitations');
```

Deve retornar:
```
workspace_users
user_invitations
```

### Como verificar se políticas foram criadas?
Execute no SQL Editor:
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('workspace_users', 'user_invitations')
ORDER BY tablename, policyname;
```

Deve retornar 8 políticas:
- `workspace_users_select_policy`
- `workspace_users_insert_policy`
- `workspace_users_update_policy`
- `workspace_users_delete_policy`
- `user_invitations_select_policy`
- `user_invitations_insert_policy`
- `user_invitations_update_policy`
- `user_invitations_delete_policy`

---

## 📝 Ordem de Execução (Importante!)

**SEMPRE execute nesta ordem**:

1. ✅ **Primeiro**: `20260108_create_workspace_users_tables.sql`
   - Cria as tabelas e políticas básicas

2. ✅ **Depois**: `20260108_fix_rls_policies.sql`
   - Remove políticas antigas e cria simplificadas
   - Corrige recursão infinita

**NÃO execute na ordem inversa**, senão dará erro!

---

## 🎉 Após Executar com Sucesso

Você poderá:

1. ✅ Acessar "Gerenciar Usuários" sem erros
2. ✅ Cadastrar novos usuários
3. ✅ Ver lista de membros do workspace
4. ✅ Alterar roles (Admin/Operador)
5. ✅ Remover usuários do workspace

---

## 📂 Arquivos Envolvidos

**Migrations**:
- [supabase/migrations/20260108_create_workspace_users_tables.sql](supabase/migrations/20260108_create_workspace_users_tables.sql)
- [supabase/migrations/20260108_fix_rls_policies.sql](supabase/migrations/20260108_fix_rls_policies.sql)

**Frontend**:
- [src/components/workspace/UserManagementDialog.tsx](src/components/workspace/UserManagementDialog.tsx)
- [src/store/workspaceStore.ts](src/store/workspaceStore.ts)

**Backend**:
- [supabase/functions/register-user/index.ts](supabase/functions/register-user/index.ts)

**Documentação**:
- [EXECUTAR_MIGRATION_USERS.md](EXECUTAR_MIGRATION_USERS.md) - Detalhes da Migration 1
- [CORRIGIR_ERRO_RLS.md](CORRIGIR_ERRO_RLS.md) - Detalhes da Migration 2
- [SIMPLIFICAR_CADASTRO_USUARIOS.md](SIMPLIFICAR_CADASTRO_USUARIOS.md) - Mudanças no frontend
- [CONFIGURACAO_EMAIL_SUPABASE.md](CONFIGURACAO_EMAIL_SUPABASE.md) - Config de email

---

## ⏱️ Tempo Estimado

- **Migration 1**: ~5 segundos
- **Migration 2**: ~3 segundos
- **Verificação**: ~1 minuto
- **Total**: ~2 minutos

---

## ✅ Checklist Final

Após executar tudo:

- [ ] Migration 1 executada (workspace_users criada)
- [ ] Migration 2 executada (RLS corrigido)
- [ ] Erros de schema desapareceram
- [ ] Login funcionando
- [ ] "Gerenciar Usuários" abre sem erro
- [ ] Botão "Cadastrar Usuário" aparece
- [ ] Lista de membros carrega

---

**Criado por**: Claude Code
**Prioridade**: 🔴 URGENTE - Execute agora para resolver os erros
**Status**: ⚠️ Pendente de execução
