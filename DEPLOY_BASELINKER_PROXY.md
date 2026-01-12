# Como Fazer Deploy da Edge Function Atualizada

## Passo a Passo

### 1. Copiar o código atualizado

Abra o arquivo: [supabase/functions/baselinker-proxy/index.ts](supabase/functions/baselinker-proxy/index.ts)

Copie **TODO** o conteúdo do arquivo.

### 2. Acessar o Supabase Dashboard

1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto: **oqwstanztqdiexgrpdta**
3. No menu lateral, clique em **Edge Functions**
4. Clique na função **baselinker-proxy**

### 3. Fazer o Deploy

1. Clique no botão **Edit** (ou **Code Editor**)
2. **Apague todo o código antigo**
3. **Cole o código novo** (copiado no passo 1)
4. Clique em **Deploy** ou **Save & Deploy**
5. Aguarde a mensagem de sucesso (normalmente 10-20 segundos)

### 4. Verificar o Deploy

Depois do deploy, verifique se aparece:
- ✅ "Deployment successful" ou similar
- ✅ A versão/timestamp atualizado

### 5. Testar no Frontend

1. Faça **hard reload** no navegador (Ctrl+Shift+R)
2. Vá em **Integrações** → **Configurar GhostAPIs**
3. Insira o token: `e83b734c357cfc9d5a2cae5eac2a6161`
4. Insira CPF de teste: `14970466700`
5. Clique em **Testar**

**Resultado esperado**:
```
✅ Conexão bem-sucedida! Dados encontrados.
Nome: [nome]
Email: [email]
Telefones: [telefones]
```

### 6. Se der erro

1. Verifique os **Logs** da Edge Function no Supabase
2. Procure por linhas com `[GHOSTAPIS PROXY]`
3. Verifique se o erro mostra qual foi o problema

---

## Resumo do que mudou

A Edge Function `baselinker-proxy` agora aceita **dois tipos de requisição**:

### Tipo 1: Baselinker (antigo, continua funcionando)
```json
{
  "apiKey": "...",
  "method": "getOrders",
  "parameters": {}
}
```

### Tipo 2: GhostAPIs (novo)
```json
{
  "service": "ghostapis",
  "endpoint": "cpf",
  "params": { "cpf2": "12345678900" },
  "workspaceId": "uuid"
}
```

A função detecta automaticamente qual tipo é e roteia para o handler correto.

---

## Troubleshooting

### "Function not found"
- Certifique-se de que está editando **baselinker-proxy** (não ghostapis-proxy)

### "Invalid syntax" ou erro de deploy
- Verifique se copiou **todo** o código do arquivo, incluindo os imports no topo

### Teste funciona mas produção não
- Faça hard reload no navegador (Ctrl+Shift+R)
- Aguarde 30 segundos após o deploy
- Limpe o cache do navegador se necessário

### CORS error persiste
- Verifique se o deploy foi bem-sucedido
- Verifique nos logs se a função está sendo invocada
- Certifique-se de que está usando `baselinker-proxy` (não `ghostapis-proxy`)

---

## Depois do deploy

Se tudo funcionar:
1. Você pode **deletar** a Edge Function `ghostapis-proxy` (não está mais sendo usada)
2. A sincronização do Baselinker já vai enriquecer clientes automaticamente via GhostAPIs

---

**Status**: Aguardando deploy da Edge Function atualizada.
