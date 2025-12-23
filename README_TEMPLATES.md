# 🎯 Sistema de Templates de Mensagens - GUIA RÁPIDO

## ⚡ Início Rápido (3 Minutos)

### 1️⃣ Execute o Script SQL

Você **JÁ TEM** a tabela `message_templates` no banco, então:

**→ Execute**: [`MIGRAR_TEMPLATES_PARA_AVANCADO.sql`](MIGRAR_TEMPLATES_PARA_AVANCADO.sql)

```
1. Acesse: https://supabase.com/dashboard/project/[SEU_ID]/editor
2. Copie TODO o conteúdo de MIGRAR_TEMPLATES_PARA_AVANCADO.sql
3. Cole no SQL Editor
4. Clique RUN
5. Aguarde: "Success. No rows returned" ✅
```

### 2️⃣ Teste no SQL Editor

Cole e execute:

```sql
SELECT
  template_type,
  LEFT(template_content, 40) as preview,
  send_config->>'timing_type' as timing,
  send_config->>'enabled' as ativo
FROM message_templates
ORDER BY workspace_id, template_type;
```

**Resultado esperado**: 3 templates com `timing` e `ativo` preenchidos.

### 3️⃣ Acesse a Interface

```bash
npm run dev
```

Abra: http://localhost:5173/message-templates

Pronto! 🎉

---

## 📂 Arquivos Importantes

### 🔧 Scripts SQL

| Arquivo | Quando Usar |
|---------|-------------|
| **MIGRAR_TEMPLATES_PARA_AVANCADO.sql** ⭐ | **Você está aqui** - Já tem a tabela |
| EXECUTAR_NO_SUPABASE_COMPLETO.sql | Nova instalação (não tem tabela) |
| EXECUTAR_NO_SUPABASE_CORRIGIDO.sql | Versão simples (sem config avançadas) |

### 📖 Documentação

| Arquivo | Conteúdo |
|---------|----------|
| **README_TEMPLATES.md** ⭐ | **Este arquivo** - Início rápido |
| INSTALAR_TEMPLATES_AVANCADO.md | Guia detalhado de instalação |
| TEMPLATES_AVANCADO.md | Documentação técnica completa |
| RESUMO_SISTEMA_TEMPLATES.md | Overview do sistema |
| CORRECAO_VENDA_CASADA.md | Sobre oferta de segunda unidade |

### 💻 Código React

| Arquivo | Descrição |
|---------|-----------|
| **MessageTemplateConfigAdvanced.tsx** ⭐ | Interface completa (recomendado) |
| MessageTemplatesConfig.tsx | Versão simples |
| MessageTemplatesPage.tsx | Página wrapper |

---

## 🎨 O Que Você Pode Configurar

### ⏰ Timing de Envio

✅ **Imediato** - Envia agora mesmo
✅ **Com atraso** - 5 min, 2h, 1 dia, etc
✅ **Antes do fim** - 15 dias antes do produto acabar

### 🔍 Filtros

✅ **Canais excluídos** - Não enviar para shop, atacado, etc
✅ **Valor mínimo/máximo** - Filtrar por valor do pedido
✅ **Primeira compra** - Apenas novos clientes
✅ **Produtos com duração** - Apenas produtos consumíveis

### 📝 3 Tipos de Mensagens

1. **Boas-vindas** - Primeira compra (imediato)
2. **Segunda unidade** - 20% desconto (5 min depois)
3. **Recompra** - Lembrete antes do produto acabar (15 dias antes)

---

## 🧪 Testar Configurações

### Cálculo de Data (5 minutos depois)

```sql
SELECT calculate_send_date(
  NOW(),
  '{"timing_type": "delayed", "delay_value": 5, "delay_unit": "minutes"}'::jsonb,
  NULL
);
```

### Cálculo de Recompra (15 dias antes, produto 30 dias)

```sql
SELECT calculate_send_date(
  '2025-01-01'::timestamptz,
  '{"timing_type": "before_end", "days_before_end": 15}'::jsonb,
  30
);
-- Resultado: 2025-01-16 (dia 1 + 30 - 15 = dia 16)
```

---

## 🎯 Configurações Padrão

Após executar a migração, seus templates terão:

### Boas-Vindas
```json
{
  "send_config": {
    "timing_type": "immediate",
    "enabled": true
  },
  "filter_config": {
    "first_order_only": true,
    "exclude_channels": []
  }
}
```

### Segunda Unidade (Upsell)
```json
{
  "send_config": {
    "timing_type": "delayed",
    "delay_value": 5,
    "delay_unit": "minutes",
    "enabled": true
  },
  "filter_config": {
    "exclude_channels": ["shop", "atacado", "whatsapp"],
    "min_order_value": 0
  }
}
```

### Recompra
```json
{
  "send_config": {
    "timing_type": "before_end",
    "days_before_end": 15,
    "enabled": true
  },
  "filter_config": {
    "only_with_duration": true,
    "exclude_channels": []
  }
}
```

---

## 🛠️ Personalizando via Interface

1. Acesse `/message-templates`
2. Escolha uma aba (Boas-Vindas, Segunda Unidade, Recompra)
3. **Edite o template** (texto da mensagem)
4. **Configure timing**:
   - Imediato / Com Atraso / Antes do Fim
   - Valores e unidades
5. **Configure filtros**:
   - Clique badges para excluir canais
   - Defina valores min/max
   - Ative switches
6. **Veja preview em tempo real**
7. **Salve**

Tudo sem mexer no código! 🎉

---

## 💡 Como Usar nas Edge Functions

```typescript
// Buscar template com configurações
const { data: template } = await supabase
  .from('message_templates')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('template_type', 'upsell')
  .eq('is_active', true)
  .single();

// Verificar filtros
if (template.filter_config.exclude_channels?.includes(order.canal_venda)) {
  return; // Canal excluído
}

// Calcular quando enviar
const { data: sendDate } = await supabase.rpc('calculate_send_date', {
  p_order_date: order.order_date,
  p_send_config: template.send_config,
  p_product_duration_days: null
});

// Enviar ou agendar
if (template.send_config.timing_type === 'immediate') {
  await sendWhatsAppMessage(workspaceId, client.phone, message);
} else {
  await supabase.from('scheduled_messages').insert({
    workspace_id: workspaceId,
    client_id: client.id,
    message_content: message,
    scheduled_for: sendDate,
    status: 'pending'
  });
}
```

Veja documentação completa em: [TEMPLATES_AVANCADO.md](TEMPLATES_AVANCADO.md)

---

## ❓ FAQ Rápido

**P: Já executei EXECUTAR_NO_SUPABASE_CORRIGIDO.sql. O que fazer?**
R: Execute MIGRAR_TEMPLATES_PARA_AVANCADO.sql para adicionar as novas colunas.

**P: Erro "column send_config does not exist"**
R: Execute MIGRAR_TEMPLATES_PARA_AVANCADO.sql.

**P: Interface não mostra as configurações**
R: Certifique-se que executou o script de migração e recarregou a página (Ctrl+F5).

**P: Como voltar atrás?**
R: As colunas são opcionais. Se deixar `send_config` vazio, usa defaults.

---

## 🆘 Problemas?

1. **Copie a mensagem de erro**
2. **Abra console do navegador** (F12)
3. **Verifique query de teste** (SELECT acima)
4. **Veja se colunas existem**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'message_templates';
```

---

## 📚 Leitura Recomendada

1. **README_TEMPLATES.md** (você está aqui) - Início rápido
2. **INSTALAR_TEMPLATES_AVANCADO.md** - Guia passo a passo
3. **TEMPLATES_AVANCADO.md** - Referência técnica
4. **RESUMO_SISTEMA_TEMPLATES.md** - Overview completo

---

**Última atualização**: 23/12/2025
**Status**: ✅ Pronto para uso

**Próximo passo**: Execute [`MIGRAR_TEMPLATES_PARA_AVANCADO.sql`](MIGRAR_TEMPLATES_PARA_AVANCADO.sql) no Supabase!
