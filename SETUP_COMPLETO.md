# Setup Completo - Sistema de Estoque Multi-Warehouse e Logs

## 📋 Resumo do Sistema

Este documento descreve o setup completo do sistema de gerenciamento de estoque multi-warehouse integrado com Baselinker e sistema de logs automáticos.

## ✅ O que foi implementado

### 1. **Sistema de Multi-Warehouse**
- ✅ Tabela `baselinker_warehouses` para configuração de warehouses por workspace
- ✅ Tabela `product_stock_by_warehouse` expandida com campos: price, cost, duracao, ean, product_name
- ✅ Frontend atualizado para exibir nomes de warehouses configuráveis
- ✅ Fallback automático para IDs quando warehouses não configurados

### 2. **Extração de Dados do Baselinker**
- ✅ Preço de venda: Primeiro valor do objeto `prices` da API
- ✅ Custo: Campo `average_cost` da API
- ✅ Duração: Campo `extra_field_63429` da API
- ✅ Dados salvos em ambas tabelas: `products` e `product_stock_by_warehouse`

### 3. **Sistema de Logs Automáticos**
- ✅ Tabela `event_queue` para eventos do Baselinker
- ✅ Tabela `stock_change_logs` para todas alterações de estoque
- ✅ Tabela `baselinker_sync_state` para controle de sincronização
- ✅ View `v_recent_stock_changes` com dados enriquecidos
- ✅ Trigger automático que registra TODAS as alterações de estoque
- ✅ Função RPC `upsert_product_stock_with_log` para updates com logging

### 4. **Interface de Logs (Jobs & Logs)**
- ✅ Página completa em `/jobs`
- ✅ Aba "Fila de Eventos" para monitorar eventos do Baselinker
- ✅ Aba "Logs de Estoque" para rastrear alterações
- ✅ Filtros por status, origem e busca
- ✅ Função de reprocessar eventos falhados

## 🚀 Scripts SQL para Executar (em ordem)

### Passo 1: Criar tabela de warehouses
```bash
Arquivo: CREATE_BASELINKER_WAREHOUSES.sql
Status: ✅ Executado (conforme seu feedback)
```

### Passo 2: Expandir tabela product_stock_by_warehouse
```bash
Arquivo: MIGRATE_PRODUCT_STOCK_BY_WAREHOUSE.sql
Descrição: Adiciona colunas ean, product_name, cost, price, duracao
Status: ⚠️ PRECISA EXECUTAR
```

### Passo 3: Criar tabelas de logs
```bash
Arquivo: CREATE_LOGS_TABLES.sql
Descrição: Cria event_queue, stock_change_logs, baselinker_sync_state, view e trigger
Status: ✅ Executado (conforme seu feedback)
```

### Passo 4: Criar função RPC para logging
```bash
Arquivo: ADD_STOCK_UPDATE_FUNCTION.sql
Descrição: Cria função upsert_product_stock_with_log
Status: ⚠️ PRECISA EXECUTAR
```

### Passo 5: Configurar warehouses (opcional)
```bash
Arquivo: INSERT_WAREHOUSES.sql
Descrição: Template para inserir configuração de warehouses
Status: ⚠️ Execute quando quiser nomear os warehouses
```

## 📝 Próximas Etapas

### 1. Execute os Scripts SQL Pendentes

No Supabase SQL Editor, execute **nesta ordem**:

```sql
-- 1. Expandir product_stock_by_warehouse (se ainda não executou)
-- Execute: MIGRATE_PRODUCT_STOCK_BY_WAREHOUSE.sql

-- 2. Criar função RPC para logging
-- Execute: ADD_STOCK_UPDATE_FUNCTION.sql
```

### 2. Configure os Warehouses (Opcional mas Recomendado)

Abra `INSERT_WAREHOUSES.sql` e:

1. Execute o **PASSO 1** para ver seus warehouse_ids
2. Execute o **PASSO 2** para pegar seu workspace_id
3. **Descomente e customize** o PASSO 3 com seus dados:
   ```sql
   INSERT INTO public.baselinker_warehouses (
     workspace_id,
     warehouse_id,
     warehouse_code,
     warehouse_name,
     is_active,
     allow_stock_updates,
     sync_direction
   )
   VALUES
     ('SEU_WORKSPACE_ID', 'bl_45090', 'ES', 'Espírito Santo', true, true, 'bidirectional'),
     ('SEU_WORKSPACE_ID', 'bl_45091', 'SP', 'São Paulo', true, true, 'bidirectional');
   ```

### 3. Teste o Sistema

1. **Vá para Integrações** → Execute sincronização do Baselinker
2. **Vá para Estoque** → Verifique:
   - ✅ Nomes de warehouses aparecem (se configurou)
   - ✅ Preços e custos estão preenchidos
   - ✅ Campo duracao está preenchido
3. **Vá para Jobs & Logs** → Verifique:
   - ✅ Aba "Logs de Estoque" mostra alterações
   - ✅ Origem = "baselinker"
   - ✅ Ação = "sync"
   - ✅ Quantidade anterior e nova estão corretas

## 🔧 Troubleshooting

### Logs não aparecem na página Jobs & Logs

**Possível causa**: Função RPC não foi criada ou trigger não está ativo

**Solução**:
```sql
-- Verificar se função existe
SELECT proname FROM pg_proc WHERE proname = 'upsert_product_stock_with_log';

-- Verificar se trigger existe
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trigger_log_stock_change';

-- Se não existir, execute ADD_STOCK_UPDATE_FUNCTION.sql novamente
```

### Warehouses aparecem como "Warehouse bl_12345"

**Causa**: Warehouses não foram configurados

**Solução**: Execute INSERT_WAREHOUSES.sql customizado

### Price, cost ou duracao aparecem como NULL

**Possível causa 1**: Migration não foi executada
```sql
-- Verificar se colunas existem
SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_stock_by_warehouse'
AND column_name IN ('price', 'cost', 'duracao');
```

**Possível causa 2**: Dados da API não estão vindo
- Verifique no console do navegador se há erros na sincronização
- Confirme que produtos no Baselinker têm esses campos preenchidos

## 📊 Estrutura de Dados

### product_stock_by_warehouse (Expandida)
```sql
- id (UUID)
- workspace_id (UUID)
- product_id (UUID)
- sku (TEXT)
- warehouse_id (TEXT)
- stock_quantity (NUMERIC)
- ean (TEXT) ⬅️ NOVO
- product_name (TEXT) ⬅️ NOVO
- cost (NUMERIC) ⬅️ NOVO
- price (NUMERIC) ⬅️ NOVO
- duracao (NUMERIC) ⬅️ NOVO
- last_sync_at (TIMESTAMPTZ) ⬅️ NOVO
```

### baselinker_warehouses (Nova)
```sql
- id (UUID)
- workspace_id (UUID)
- warehouse_id (TEXT)
- warehouse_code (TEXT) - Ex: "ES", "SP"
- warehouse_name (TEXT) - Ex: "Espírito Santo"
- is_active (BOOLEAN)
- allow_stock_updates (BOOLEAN)
- sync_direction (TEXT) - 'bidirectional', 'read_only', 'write_only'
```

### stock_change_logs (Nova)
```sql
- id (UUID)
- workspace_id (UUID)
- product_id (UUID)
- sku (TEXT)
- product_name (TEXT)
- warehouse_id (TEXT)
- action_type (TEXT) - 'sync', 'manual_update', 'purchase', etc
- source (TEXT) - 'baselinker', 'manual', 'system', etc
- previous_quantity (NUMERIC)
- new_quantity (NUMERIC)
- quantity_change (NUMERIC)
- change_reason (TEXT)
- user_id (UUID)
- created_at (TIMESTAMPTZ)
```

## 🎯 Benefícios do Sistema

1. **Multi-Workspace Isolado**: Cada cliente tem seus próprios warehouses e configurações
2. **Rastreabilidade Total**: Todo update de estoque é registrado automaticamente
3. **Nomes Customizáveis**: Cada workspace pode nomear seus warehouses como quiser
4. **Auditoria Completa**: Sabe quem, quando e por que o estoque mudou
5. **Debugging Facilitado**: Página de logs mostra tudo que aconteceu
6. **Reprocessamento**: Eventos falhados podem ser reprocessados manualmente

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do navegador (F12 → Console)
2. Verifique a página Jobs & Logs para erros
3. Execute as queries de verificação nos scripts SQL
4. Confirme que todos os scripts foram executados na ordem correta
