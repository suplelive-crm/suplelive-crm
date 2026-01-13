# Como Resolver o Problema de Workspaces Duplicados

## Problema Identificado

Na screenshot você mostra que há 2 workspaces "suplelive" aparecendo no dropdown. Isso acontece porque:

1. **Usuário é owner E membro**: O usuário ph@suplelive.com.br provavelmente foi adicionado à tabela `workspace_users` mesmo sendo o owner do workspace
2. **Função RPC retorna duplicatas**: A função `get_user_workspaces()` não estava filtrando duplicatas quando o mesmo workspace aparece por 2 caminhos diferentes (owner + member)

## Solução (Execute nesta ordem)

### Passo 1: Verificar o Problema

Execute no SQL Editor do Supabase:

```sql
-- Ver se há owners que também estão em workspace_users
SELECT
  u.email,
  w.name as workspace_name,
  'É owner E também está em workspace_users' as problema
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
WHERE w.owner_id = wu.user_id;
```

Se esta query retornar resultados, você tem duplicatas.

### Passo 2: Limpar Duplicatas

Execute o SQL do arquivo `cleanup_workspace_users.sql`:

**IMPORTANTE**: Execute primeiro o SELECT para ver o que será deletado:

```sql
SELECT
  wu.id,
  w.name as workspace_name,
  u.email as user_email,
  wu.role,
  'OWNER duplicado em workspace_users' as reason
FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
JOIN auth.users u ON wu.user_id = u.id
WHERE w.owner_id = wu.user_id;
```

Se estiver OK, execute o DELETE:

```sql
DELETE FROM workspace_users
WHERE id IN (
  SELECT wu.id
  FROM workspace_users wu
  JOIN workspaces w ON wu.workspace_id = w.id
  WHERE w.owner_id = wu.user_id
);
```

### Passo 3: Atualizar Função RPC

Execute o SQL do arquivo `fix_duplicate_workspaces.sql` para atualizar a função `get_user_workspaces()` com proteção contra duplicatas.

### Passo 4: Testar

1. Faça logout do sistema
2. Faça login novamente
3. Clique no dropdown de workspaces na sidebar
4. Agora você deve ver apenas 1 workspace "suplelive" (não 2)

## Por Que Aconteceu?

Quando você criou o usuário Matheus (contato@suplelive.com.br) e o adicionou ao workspace, pode ter havido alguma confusão que também adicionou o owner (ph@suplelive.com.br) à tabela `workspace_users`.

**Regra**:
- Se um usuário é **owner** do workspace → NÃO deve estar em `workspace_users`
- Se um usuário é **membro** do workspace → DEVE estar em `workspace_users`

## Prevenção Futura

A função RPC atualizada (`get_user_workspaces`) agora tem uma cláusula:

```sql
AND w.owner_id != current_user_id  -- Exclude if user is owner
```

Isso garante que mesmo se houver duplicatas no banco, a função não retornará workspaces duplicados.
