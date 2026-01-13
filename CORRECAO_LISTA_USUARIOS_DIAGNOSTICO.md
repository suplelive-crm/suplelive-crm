# Correção: Lista de Usuários Mostrando Dados Incorretos

## Problema Identificado

Nas screenshots você mostra que:

1. **Quando logado como `ph@suplelive.com.br`**: A lista de usuários mostra corretamente
   - ph@suplelive.com.br = Proprietário ✅
   - Matheus Muniz (contato@suplelive.com.br) = Administrador ✅

2. **Quando logado como `contato@suplelive.com.br`**: A lista mostra INCORRETAMENTE
   - contato@suplelive.com.br = Proprietário do workspace ❌ (deveria ser Administrador)
   - Matheus Muniz (contato@suplelive.com.br) = Administrador ✅

## Possíveis Causas

### Causa 1: Dados Duplicados/Incorretos no Banco
- Pode haver 2 workspaces "suplelive" com owners diferentes
- Pode haver o usuário `contato@suplelive.com.br` marcado como owner de um workspace
- Pode haver entradas duplicadas/incorretas em `workspace_users`

### Causa 2: Função RPC Incorreta
- A função `get_workspace_users_with_details` pode estar retornando dados errados
- Ela pode não estar filtrando corretamente por workspace

### Causa 3: Problema no Frontend
- O componente `UserManagementDialog` pode estar usando o workspace errado
- Pode estar mostrando "Proprietário do workspace" baseado em lógica incorreta

## Etapas de Diagnóstico

### Passo 1: Execute o SQL de Investigação

Execute o arquivo `check_matheus_status.sql` no Supabase SQL Editor. Isso vai mostrar:
- Todos os usuários
- Todos os workspaces
- Todas as relações workspace_users
- Duplicatas
- Dados específicos do workspace "suplelive"

**Procure por**:
- Há 2 workspaces "suplelive"? (Query 4 e 6)
- O `contato@suplelive.com.br` aparece como owner de algum workspace? (Query 2)
- Há entries duplicadas em workspace_users? (Query 3 e 5)

### Passo 2: Verificar a Função RPC

Execute o arquivo `check_rpc_function.sql` para:
1. Ver o código da função `get_workspace_users_with_details`
2. Encontrar o ID do workspace "suplelive"
3. Testar a função manualmente

### Passo 3: Baseado nos Resultados

**Se encontrar duplicatas de workspace**:
```sql
-- Verificar qual é o correto
SELECT id, name, owner_id, created_at
FROM workspaces
WHERE name = 'suplelive'
ORDER BY created_at ASC;

-- O mais antigo provavelmente é o correto
-- Anote o ID do workspace correto e delete o duplicado:
DELETE FROM workspaces WHERE id = 'UUID_DO_DUPLICADO';
```

**Se encontrar owner incorreto**:
```sql
-- Corrigir o owner_id do workspace
UPDATE workspaces
SET owner_id = 'UUID_DO_PH@SUPLELIVE'
WHERE id = 'UUID_DO_WORKSPACE_SUPLELIVE';
```

**Se encontrar entradas incorretas em workspace_users**:
```sql
-- Ver quem está incorretamente em workspace_users
SELECT * FROM workspace_users wu
JOIN workspaces w ON wu.workspace_id = w.id
WHERE w.owner_id = wu.user_id;

-- Deletar owners que estão em workspace_users
DELETE FROM workspace_users
WHERE id IN (
  SELECT wu.id
  FROM workspace_users wu
  JOIN workspaces w ON wu.workspace_id = w.id
  WHERE w.owner_id = wu.user_id
);
```

## Ação Recomendada

1. **PRIMEIRO**: Execute `check_matheus_status.sql` e me mande os resultados
2. **Analise** os resultados comigo
3. **DEPOIS**: Executamos o SQL de correção apropriado

## Hipótese Mais Provável

Baseado no comportamento, acredito que:

1. O usuário `ph@suplelive.com.br` criou o workspace "suplelive" ✅
2. Você criou o usuário `contato@suplelive.com.br` como Administrador ✅
3. MAS algo adicionou `ph@suplelive.com.br` também à tabela `workspace_users` ❌
4. A função `get_workspace_users_with_details` retorna:
   - ph@suplelive tanto como owner quanto como member
   - Isso causa confusão no frontend

**Solução**: Remover `ph@suplelive.com.br` da tabela `workspace_users` (ele já é owner).

Execute as queries e me mostre os resultados!
