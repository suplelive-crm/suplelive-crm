# 🔐 Sistema de Validação Avançada de Telefone

**Data**: 08/01/2026
**Status**: ✅ Implementado

---

## 📋 Visão Geral

Sistema de validação em múltiplas camadas para garantir que apenas telefones válidos do WhatsApp sejam cadastrados, com verificação de nome do usuário para segurança adicional.

---

## 🎯 Fluxo Completo de Validação

### **Cenário: Pedido chega sem telefone**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. PEDIDO CHEGA DO BASELINKER                                │
│    - Cliente: João Silva                                     │
│    - CPF: 123.456.789-00                                     │
│    - Telefone: ❌ VAZIO                                       │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. VERIFICAR SE CLIENTE EXISTE                               │
│    - Busca por CPF no banco                                  │
│    - Não encontrado → Iniciar criação                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. BUSCAR TELEFONES NO GHOSTAPI                              │
│    → POST /consulta/cpf                                      │
│    → Body: { "cpf": "12345678900" }                          │
│    ← Response: {                                             │
│        "telefones": [                                        │
│          { "numero": "27999999999", "tipo": "CELULAR" },     │
│          { "numero": "27988888888", "tipo": "CELULAR" },     │
│          { "numero": "2733333333", "tipo": "FIXO" }          │
│        ]                                                     │
│      }                                                       │
│    ✅ Encontrou 3 telefones                                  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. VALIDAR CADA TELEFONE NO WHATSAPP                         │
│                                                              │
│  Telefone 1: 5527999999999                                   │
│    → Evolution API: POST /chat/whatsappNumbers               │
│    ← Response: {                                             │
│        "exists": true,                                       │
│        "name": "João Silva Santos",                          │
│        "jid": "5527999999999@s.whatsapp.net"                 │
│      }                                                       │
│    ✅ Existe no WhatsApp!                                     │
│                                                              │
│  Telefone 2: 5527988888888                                   │
│    → Evolution API: POST /chat/whatsappNumbers               │
│    ← Response: { "exists": false }                           │
│    ❌ Não existe no WhatsApp                                  │
│                                                              │
│  Telefone 3: 552733333333 (fixo)                            │
│    → Evolution API: POST /chat/whatsappNumbers               │
│    ← Response: { "exists": false }                           │
│    ❌ Não existe no WhatsApp                                  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. CALCULAR SIMILARIDADE DE NOME                             │
│                                                              │
│  Telefone 1:                                                 │
│    Nome do pedido: "João Silva"                              │
│    Nome do WhatsApp: "João Silva Santos"                     │
│    → Similaridade: 85%                                       │
│    → Score: 50 (WhatsApp) + 42.5 (nome) = 92.5              │
│    ✅ APROVADO (score >= 60)                                  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. CADASTRAR CLIENTE COM TELEFONE VALIDADO                   │
│    - Nome: João Silva                                        │
│    - CPF: 123.456.789-00                                     │
│    - Telefone: 5527999999999 ✅                               │
│    - Metadata: {                                             │
│        phone_validation: {                                   │
│          validated: true,                                    │
│          source: "ghost_api_whatsapp",                       │
│          validated_at: "2026-01-08T...",                     │
│          whatsapp_name: "João Silva Santos",                 │
│          similarity: 85                                      │
│        }                                                     │
│      }                                                       │
│    ✅ MENSAGEM DE BOAS-VINDAS ENVIADA                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔍 Sistema de Score

### **Como Funciona o Score de Validação:**

```javascript
Score Total = 50 (WhatsApp válido) + (Similaridade Nome ÷ 2)

Exemplo 1:
- Telefone existe no WhatsApp: +50 pontos
- Similaridade de nome: 85%
- Score: 50 + (85 / 2) = 92.5 ✅ APROVADO

Exemplo 2:
- Telefone existe no WhatsApp: +50 pontos
- Similaridade de nome: 10%
- Score: 50 + (10 / 2) = 55 ❌ REJEITADO (< 60)

Exemplo 3:
- Telefone NÃO existe no WhatsApp: 0 pontos
- Score: 0 ❌ REJEITADO
```

### **Critério de Aceitação:**

- ✅ **Score >= 60**: Telefone aceito e cadastrado
- ❌ **Score < 60**: Telefone rejeitado
  - Nome do WhatsApp muito diferente do nome do pedido
  - Provavelmente não é o telefone correto do cliente

---

## 📊 Algoritmo de Similaridade de Nome

Usa **Levenshtein Distance** para calcular similaridade:

```typescript
// Exemplo de cálculo
Nome Pedido:    "João Silva"
Nome WhatsApp:  "João Silva Santos"

1. Normalizar:
   - Lowercase
   - Remover acentos
   - Trim espaços

2. Calcular distância:
   - "joao silva" vs "joao silva santos"
   - Distância: 7 caracteres diferentes
   - Max Length: 18

3. Similaridade:
   - (18 - 7) / 18 * 100 = 61%

4. Score:
   - 50 + (61 / 2) = 80.5 ✅
```

---

## 🛠️ Componentes Implementados

### **1. Edge Function: `validate-whatsapp-number`**

**Localização**: `supabase/functions/validate-whatsapp-number/index.ts`

**O que faz**:
- Recebe telefone e ID da instância Evolution
- Valida se número existe no WhatsApp
- Retorna nome do usuário do WhatsApp

**Input**:
```typescript
{
  phone: "5527999999999",
  instanceId: "uuid-da-instancia"
}
```

**Output**:
```typescript
{
  exists: true,
  name: "João Silva Santos",
  phone: "5527999999999",
  verified: true
}
```

### **2. Módulo: `validate-client-data.ts`**

**Localização**: `supabase/functions/process-order-created/validate-client-data.ts`

**Funções**:

#### `searchPhonesByGhostAPI(cpf, workspaceId)`
- Busca telefones no GhostAPI usando CPF
- Retorna array de telefones encontrados

#### `validateWhatsAppNumber(phone, instanceId, expectedName)`
- Valida telefone no WhatsApp via Evolution API
- Calcula similaridade de nome
- Retorna objeto de validação

#### `calculateNameSimilarity(name1, name2)`
- Calcula similaridade entre dois nomes
- Usa algoritmo Levenshtein Distance
- Retorna percentual 0-100

#### `validateAndFindBestPhone(cpf, customerName, workspaceId, instanceId)` **(PRINCIPAL)**
- Orquestra todo o fluxo de validação
- Busca no GhostAPI → Valida no WhatsApp → Calcula score → Retorna melhor telefone

### **3. Integração: `process-order-created/index.ts`**

**Localização**: `supabase/functions/process-order-created/index.ts` (linhas 149-238)

**Lógica**:
```typescript
// Se pedido NÃO tem telefone E tem CPF
if (!phone && cpf) {
  // Buscar instância WhatsApp ativa
  const whatsappInstance = await getActiveInstance();

  // Validar e encontrar melhor telefone
  validatedPhone = await validateAndFindBestPhone(
    cpf,
    customerName,
    workspaceId,
    whatsappInstance.id,
    supabaseClient
  );
}

// Criar cliente (com ou sem telefone)
const client = await createClient({
  phone: validatedPhone, // null se nenhum telefone válido
  metadata: {
    phone_validation: {
      validated: !!validatedPhone,
      source: validatedPhone ? 'ghost_api_whatsapp' : null,
      reason: !validatedPhone ? 'no_valid_phone_found' : null
    }
  }
});

// Enviar mensagem APENAS se tiver telefone
if (validatedPhone) {
  await sendWelcomeMessage(client);
}
```

---

## 🔧 Configuração Necessária

### **1. GhostAPI**

**Em**: Configurações → Workspace → Integrações → GhostAPI

```json
{
  "ghost_api": {
    "api_key": "sua-chave-ghost-api",
    "base_url": "https://api.ghostapi.com.br"
  }
}
```

### **2. Evolution API**

**Pré-requisitos**:
- Instância WhatsApp conectada
- Status: "connected"
- Configurado em: `whatsapp_instances` table

### **3. Deploy Edge Functions**

```bash
# Deploy validate-whatsapp-number
npx supabase functions deploy validate-whatsapp-number

# Deploy process-order-created (já atualizado)
npx supabase functions deploy process-order-created
```

---

## 📝 Logs e Debugging

### **Exemplo de Log Completo:**

```
=== Iniciando validação de telefone ===
CPF: 12345678900
Nome esperado: João Silva

Consultando GhostAPI para CPF: 12345678900
GhostAPI retornou 3 telefone(s)

Validando telefone no WhatsApp: 5527999999999
Similaridade de nome: 85% (WhatsApp: "João Silva Santos" vs Pedido: "João Silva")

Validando telefone no WhatsApp: 5527988888888
Telefone não existe no WhatsApp

Validando telefone no WhatsApp: 552733333333
Telefone não existe no WhatsApp

=== Resultado da validação ===
Telefones encontrados: 3
Telefones válidos no WhatsApp: 1
Melhor telefone: 5527999999999
Nome do WhatsApp: João Silva Santos
Similaridade de nome: 85%
Score final: 92.5
✅ Telefone aceito (score >= 60)
```

---

## 🎭 Casos de Uso

### **Caso 1: Pedido SEM telefone, COM CPF, GhostAPI encontra telefone válido**
```
Entrada: { cpf: "123...", telefone: "" }
GhostAPI: [ "27999999999" ]
WhatsApp: Existe (nome: "João Silva")
Similaridade: 90%
Score: 95
→ ✅ Cliente criado com telefone 5527999999999
→ ✅ Mensagem enviada
```

### **Caso 2: Pedido SEM telefone, COM CPF, GhostAPI encontra telefone mas nome não bate**
```
Entrada: { cpf: "123...", telefone: "" }
GhostAPI: [ "27999999999" ]
WhatsApp: Existe (nome: "Maria Souza")
Similaridade: 5%
Score: 52.5
→ ❌ Telefone rejeitado
→ ⚠️ Cliente criado SEM telefone
→ ❌ Mensagem NÃO enviada
```

### **Caso 3: Pedido SEM telefone, COM CPF, GhostAPI não encontra telefones**
```
Entrada: { cpf: "123...", telefone: "" }
GhostAPI: []
→ ⚠️ Cliente criado SEM telefone
→ ❌ Mensagem NÃO enviada
```

### **Caso 4: Pedido COM telefone (ignora validação extra)**
```
Entrada: { cpf: "123...", telefone: "27999999999" }
→ ℹ️ Telefone do pedido usado diretamente
→ ✅ Cliente criado com telefone do pedido
→ ✅ Mensagem enviada
```

---

## ⚠️ Avisos e Considerações

### **Limitações:**

1. **Depende de GhostAPI**:
   - Se GhostAPI estiver fora, validação não funciona
   - Cliente será criado sem telefone

2. **Depende de Evolution API**:
   - Precisa de instância WhatsApp conectada
   - Se não tiver, validação é pulada

3. **Score pode rejeitar telefones legítimos**:
   - Se nome do WhatsApp for muito diferente do nome do pedido
   - Ex: Pedido "João Silva" vs WhatsApp "JS Empresas"

4. **Performance**:
   - Para cada telefone encontrado, faz chamada ao WhatsApp
   - Se GhostAPI retornar 10 telefones, fará 10 validações
   - Pode demorar alguns segundos

### **Segurança:**

- ✅ Valida que telefone existe no WhatsApp
- ✅ Valida que nome do WhatsApp é similar ao nome do pedido
- ✅ Evita cadastrar telefones incorretos
- ✅ Registra origem e score no metadata
- ✅ Não envia mensagem se telefone não for validado

---

## 🔍 Troubleshooting

### **Cliente criado sem telefone sendo que deveria ter**

**Verificar**:
1. GhostAPI está configurado? (workspace.settings.ghost_api)
2. GhostAPI retornou telefones? (ver logs)
3. Telefones existem no WhatsApp? (ver logs de validação)
4. Score dos telefones >= 60? (ver logs de score)

### **Telefone rejeitado mas era correto**

**Possível causa**: Nome do WhatsApp muito diferente do nome do pedido

**Solução**:
- Reduzir score mínimo de 60 para 50 (mais permissivo)
- Ou ajustar lógica de similaridade

### **Validação muito lenta**

**Causa**: Muitos telefones para validar

**Solução**:
- Limitar quantidade de telefones a validar (ex: primeiros 3)
- Adicionar cache de validações

---

**Criado por**: Claude Code
**Data**: 08/01/2026
**Status**: ✅ Pronto para deploy
