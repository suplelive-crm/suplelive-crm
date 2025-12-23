# 🚀 Instalação Rápida - Templates com Configurações Avançadas

## 📋 O Que Você Ganha

✅ **Controle de Timing**: Configure quando cada mensagem é enviada (imediato, com atraso, antes do fim)
✅ **Filtros Avançados**: Defina canais excluídos, valor mínimo/máximo, primeira compra, etc
✅ **Interface Visual**: Configure tudo via interface, sem mexer no código
✅ **Cálculo Automático**: Funções SQL calculam automaticamente quando enviar

---

## 🔍 Qual Script Executar?

### ✅ Se JÁ TEM a tabela message_templates

**Execute**: `MIGRAR_TEMPLATES_PARA_AVANCADO.sql`

Este script irá:
- Adicionar colunas `send_config` e `filter_config`
- Criar índices GIN
- Atualizar função `get_message_template()`
- Criar função `calculate_send_date()`
- Preencher configurações padrão

### ✅ Se NÃO TEM a tabela (Nova Instalação)

**Execute**: `EXECUTAR_NO_SUPABASE_COMPLETO.sql`

Este script cria tudo do zero com configurações avançadas.

---

## ⚡ Instalação em 3 Passos

### PASSO 1: Execute o SQL

**Se JÁ TEM a tabela message_templates** (seu caso):

1. Abra: https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
2. Cole **TODO** o conteúdo do arquivo: `MIGRAR_TEMPLATES_PARA_AVANCADO.sql`
3. Clique em **RUN**
4. Aguarde: ✅ **"Success. No rows returned"**

**Se NÃO TEM a tabela** (nova instalação):

1. Abra: https://supabase.com/dashboard/project/[SEU_PROJECT_ID]/editor
2. Cole **TODO** o conteúdo do arquivo: `EXECUTAR_NO_SUPABASE_COMPLETO.sql`
3. Clique em **RUN**
4. Aguarde: ✅ **"Success. No rows returned"**

### PASSO 2: Verifique a Instalação

Cole esta query no SQL Editor:

```sql
SELECT
  template_type,
  LEFT(template_content, 40) as preview,
  send_config->>'timing_type' as timing,
  send_config->>'enabled' as habilitado,
  filter_config
FROM message_templates
ORDER BY workspace_id, template_type;
```

**Resultado esperado**: 3 templates por workspace com configurações

### PASSO 3: Use a Interface

```bash
# Iniciar servidor (se não estiver rodando)
npm run dev
```

Acesse: http://localhost:5173/message-templates

---

## 🎨 Componentes Criados

### Componente Avançado (Recomendado)

**Arquivo**: `src/components/automation/MessageTemplateConfigAdvanced.tsx`

**Features**:
- Editor de template
- Configurações de timing visual
- Seleção de canais excluídos (badges clicáveis)
- Filtros de valor do pedido
- Preview em tempo real
- Info cards com timing

**Como usar**:
```typescript
import { MessageTemplateConfigAdvanced } from '@/components/automation/MessageTemplateConfigAdvanced';

// Na sua página
<MessageTemplateConfigAdvanced />
```

### Componente Simples (Já Existe)

**Arquivo**: `src/components/automation/MessageTemplatesConfig.tsx`

Versão básica sem configurações avançadas.

---

## 🔄 Migração Detalhada (Referência)

O script `MIGRAR_TEMPLATES_PARA_AVANCADO.sql` faz o seguinte:

```sql
-- Adicionar colunas novas
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS send_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '{}'::jsonb;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_message_templates_send_config
  ON public.message_templates USING GIN (send_config);

CREATE INDEX IF NOT EXISTS idx_message_templates_filter_config
  ON public.message_templates USING GIN (filter_config);

-- Atualizar templates existentes com configurações padrão
UPDATE message_templates
SET
  send_config = CASE template_type
    WHEN 'welcome' THEN '{"timing_type": "immediate", "enabled": true}'::jsonb
    WHEN 'upsell' THEN '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes", "enabled": true}'::jsonb
    WHEN 'reorder' THEN '{"timing_type": "before_end", "days_before_end": 15, "enabled": true}'::jsonb
  END,
  filter_config = CASE template_type
    WHEN 'welcome' THEN '{"first_order_only": true, "exclude_channels": []}'::jsonb
    WHEN 'upsell' THEN '{"exclude_channels": ["shop", "atacado", "whatsapp"], "min_order_value": 0}'::jsonb
    WHEN 'reorder' THEN '{"exclude_channels": [], "only_with_duration": true, "min_order_value": 0}'::jsonb
  END
WHERE send_config = '{}'::jsonb OR send_config IS NULL;

-- Recriar função get_message_template (agora retorna configurações também)
CREATE OR REPLACE FUNCTION get_message_template(
  p_workspace_id UUID,
  p_template_type TEXT
) RETURNS TABLE (
  template_content TEXT,
  send_config JSONB,
  filter_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.template_content,
    mt.send_config,
    mt.filter_config
  FROM public.message_templates mt
  WHERE mt.workspace_id = p_workspace_id
    AND mt.template_type = p_template_type
    AND mt.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função de cálculo de data
CREATE OR REPLACE FUNCTION calculate_send_date(
  p_order_date TIMESTAMPTZ,
  p_send_config JSONB,
  p_product_duration_days INTEGER DEFAULT NULL
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_timing_type TEXT;
  v_delay_value INTEGER;
  v_delay_unit TEXT;
  v_days_before_end INTEGER;
  v_send_date TIMESTAMPTZ;
BEGIN
  v_timing_type := p_send_config->>'timing_type';

  CASE v_timing_type
    WHEN 'immediate' THEN
      v_send_date := NOW();

    WHEN 'delayed' THEN
      v_delay_value := (p_send_config->>'delay_value')::INTEGER;
      v_delay_unit := p_send_config->>'delay_unit';

      CASE v_delay_unit
        WHEN 'minutes' THEN
          v_send_date := p_order_date + (v_delay_value || ' minutes')::INTERVAL;
        WHEN 'hours' THEN
          v_send_date := p_order_date + (v_delay_value || ' hours')::INTERVAL;
        WHEN 'days' THEN
          v_send_date := p_order_date + (v_delay_value || ' days')::INTERVAL;
        ELSE
          v_send_date := p_order_date;
      END CASE;

    WHEN 'before_end' THEN
      IF p_product_duration_days IS NULL THEN
        v_send_date := p_order_date + INTERVAL '30 days';
      ELSE
        v_days_before_end := (p_send_config->>'days_before_end')::INTEGER;
        v_send_date := p_order_date + (p_product_duration_days - v_days_before_end || ' days')::INTERVAL;
      END IF;

    ELSE
      v_send_date := NOW();
  END CASE;

  RETURN v_send_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 🧪 Testar Configurações

### Teste 1: Ver Templates com Configurações

```sql
SELECT
  template_type,
  send_config->>'timing_type' as quando,
  send_config,
  filter_config
FROM message_templates
WHERE workspace_id = '[seu_workspace_id]';
```

### Teste 2: Calcular Data de Envio (5 minutos depois)

```sql
SELECT calculate_send_date(
  NOW(),
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
);
```

### Teste 3: Calcular Data de Recompra (15 dias antes, produto 30 dias)

```sql
SELECT calculate_send_date(
  '2025-01-01 10:00:00'::timestamptz,
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30
);
-- Resultado esperado: 2025-01-16 10:00:00
```

---

## 📖 Documentação Completa

- **TEMPLATES_AVANCADO.md** - Documentação técnica completa
- **COMO_USAR_TEMPLATES.md** - Como usar a versão simples
- **CORRECAO_VENDA_CASADA.md** - Explicação sobre oferta de segunda unidade

---

## 🎯 Configurações Padrão

### Boas-Vindas (Welcome)
- **Timing**: Imediato
- **Filtros**: Apenas primeira compra

### Oferta de Segunda Unidade (Upsell)
- **Timing**: 5 minutos após pedido
- **Filtros**: Excluir canais "shop", "atacado", "whatsapp"

### Recompra (Reorder)
- **Timing**: 15 dias antes do produto acabar
- **Filtros**: Apenas produtos com duração cadastrada

---

## 🛠️ Customizar via Interface

1. Acesse: http://localhost:5173/message-templates
2. Escolha uma aba (Boas-Vindas, Segunda Unidade, Recompra)
3. **Edite o template** no editor à esquerda
4. **Configure timing**:
   - Ative/desative o envio
   - Escolha: Imediato, Com Atraso, Antes do Fim
   - Configure valores (minutos, horas, dias)
5. **Configure filtros**:
   - Clique nos badges para excluir canais
   - Defina valor mínimo/máximo
   - Ative switches (primeira compra, apenas com duração)
6. Veja **preview em tempo real** à direita
7. Clique em **Salvar Template**

---

## ✅ Checklist de Instalação

- [ ] SQL executado no Supabase (EXECUTAR_NO_SUPABASE_COMPLETO.sql)
- [ ] Query de verificação retorna 3 templates
- [ ] Interface acessível em /message-templates
- [ ] Consegue editar template e ver preview
- [ ] Configurações de timing aparecem
- [ ] Filtros de canal funcionam (badges clicáveis)
- [ ] Botão "Salvar" funciona sem erros
- [ ] Teste da função calculate_send_date retorna data correta

---

## 🆘 Problemas Comuns

### "Tabela message_templates não existe"

**Solução**: Execute o SQL completo novamente.

### "Coluna send_config não existe"

**Solução**: Você executou a versão simples. Use a migração acima.

### Interface não carrega templates

**Solução**:
1. Abra console do navegador (F12)
2. Veja erros relacionados a `message_templates`
3. Verifique se está logado no workspace correto

### Função calculate_send_date não existe

**Solução**: Execute a parte de criação da função do SQL.

---

## 🚀 Próximos Passos

Após instalação:

1. **Personalize templates** via interface
2. **Ajuste timings** conforme seu negócio
3. **Configure filtros** para seus canais
4. **Teste com pedidos reais**
5. **(Opcional) Migre Edge Functions** para usar templates do banco

Veja `TEMPLATES_AVANCADO.md` para exemplos de uso nas Edge Functions.

---

**Pronto!** 🎉

Agora você tem um sistema completo de templates com configurações avançadas, tudo via interface visual!
