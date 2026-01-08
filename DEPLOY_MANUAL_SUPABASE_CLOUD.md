# 🚀 Deploy Manual - Supabase Cloud (Dashboard)

**Data**: 08/01/2026
**Para**: Supabase Cloud (site supabase.com)

---

## 📋 Passo a Passo Completo

### **Função 1: validate-whatsapp-number** (Nova)

#### **1.1. Acessar Edge Functions**

1. Abra: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. No menu lateral esquerdo, procure e clique em **"Edge Functions"**
3. Clique no botão **"+ New Function"** ou **"Create a new function"**

#### **1.2. Configurar Função**

1. **Function name**: Digite `validate-whatsapp-number`
2. Você verá um editor de código com template básico
3. **Apague todo o código** que vem por padrão

#### **1.3. Copiar Código**

Abra o arquivo local:
```
c:\Users\paull\Documents\GitHub\suplelive-crm\supabase\functions\validate-whatsapp-number\index.ts
```

**Copie TODO o conteúdo** (Ctrl+A → Ctrl+C) e **cole no editor** do Supabase Dashboard (Ctrl+V)

#### **1.4. Deploy**

1. Clique no botão **"Deploy function"** (canto superior direito)
2. Aguarde mensagem de sucesso
3. Verifique se aparece **"Deployed"** ou status verde

---

### **Função 2: process-order-created** (Atualizar)

#### **2.1. Verificar se Função Existe**

1. No menu **"Edge Functions"**, veja se já existe `process-order-created`
2. **Se EXISTIR**: Clique nela para abrir
3. **Se NÃO EXISTIR**: Clique em **"+ New Function"** e crie com nome `process-order-created`

#### **2.2. Problema: Múltiplos Arquivos**

O Dashboard do Supabase Cloud **NÃO suporta múltiplos arquivos** diretamente. Então precisamos **consolidar tudo em um único arquivo**.

---

## 🔧 Solução: Arquivo Consolidado

Vou criar um arquivo único com todo o código consolidado:

### **2.3. Copiar Código Consolidado**

Abra o arquivo que vou criar:
```
c:\Users\paull\Documents\GitHub\suplelive-crm\supabase\functions\process-order-created\index-consolidated.ts
```

**OU** copie e cole o código abaixo diretamente no editor do Dashboard:

---

## 📝 Código Consolidado para `process-order-created`

**INSTRUÇÕES**:
1. No Dashboard, abra a função `process-order-created` (ou crie nova)
2. **Apague TODO o código atual**
3. Cole o código do arquivo `index-consolidated.ts` que vou criar
4. Clique em **"Deploy function"**

---

## ✅ Verificar se Funcionou

### **Após Deploy:**

1. **Edge Functions** → Veja as duas funções:
   - ✅ `validate-whatsapp-number` - Status: Active/Deployed
   - ✅ `process-order-created` - Status: Active/Deployed

2. **Testar validate-whatsapp-number**:
   - Clique na função
   - Vá em **"Invocations"** ou **"Logs"**
   - Clique em **"Test"** (se disponível)

3. **Verificar Logs**:
   - Se houver erros, aparecerão nos logs
   - Erros de sintaxe impedem o deploy

---

## ⚠️ Observações Importantes

### **Dashboard Supabase Cloud:**

- ✅ **Suporta**: Edge Functions via editor web
- ✅ **Deploy**: Instantâneo (sem Docker necessário)
- ❌ **Limitação**: Apenas 1 arquivo por função (sem `import` de arquivos locais)
- ✅ **Solução**: Consolidar todo código em arquivo único

### **Imports Permitidos:**

```typescript
// ✅ FUNCIONAM (URLs externas)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ❌ NÃO FUNCIONAM (arquivos locais)
import { validateAndFindBestPhone } from './validate-client-data.ts';
import { fetchOrderDetails } from '../_shared/baselinker.ts';
```

**Por isso**: Vou consolidar tudo em um único arquivo.

---

## 📂 Estrutura Após Consolidação

### **validate-whatsapp-number**
- ✅ Arquivo único (já está OK)
- ✅ Deploy direto

### **process-order-created**
- ⚠️ Originalmente: múltiplos arquivos
- ✅ Solução: `index-consolidated.ts` (arquivo único)
- ✅ Contém todo código inline (sem imports locais)

---

## 🎯 Próximos Passos

1. **Aguarde**: Vou criar o arquivo consolidado `index-consolidated.ts`
2. **Copie**: O conteúdo desse arquivo
3. **Cole**: No Dashboard do Supabase
4. **Deploy**: Clique no botão de deploy
5. **Teste**: Criar um pedido no Baselinker e verificar logs

---

**Criado por**: Claude Code
**Status**: ⏳ Criando arquivo consolidado...
