# Baselinker Rate Limiting - Documentação

## ✅ O que foi implementado

Implementamos um sistema completo de **rate limiting e cache** para evitar bloqueios de token da API Baselinker.

### 🔧 Funcionalidades

1. **Rate Limiting Automático**
   - Intervalo mínimo de 1 segundo entre requisições
   - Previne múltiplas requisições simultâneas
   - Aguarda automaticamente antes de fazer a próxima chamada

2. **Sistema de Cache**
   - Cache de 60 segundos para respostas da API
   - Evita requisições desnecessárias para dados recentes
   - Melhora performance e reduz custos de API

3. **Detecção de Rate Limit**
   - Detecta automaticamente quando o token é bloqueado
   - Exibe mensagem amigável com hora de desbloqueio
   - Previne tentativas durante período de bloqueio

4. **Tratamento de Erros Melhorado**
   - Mensagens específicas para diferentes tipos de erro
   - Logs detalhados para debugging
   - Toast notifications informativas

## 📋 Como funciona

### Rate Limiting
```typescript
// Aguarda 1 segundo entre cada requisição
const timeSinceLastRequest = now - this.lastRequestTime;
if (timeSinceLastRequest < this.minRequestInterval) {
  await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLastRequest));
}
```

### Cache
```typescript
// Verifica cache antes de fazer requisição
const cacheKey = this.getCacheKey(apiKey, method, parameters);
const cached = this.getFromCache<T>(cacheKey);
if (cached) {
  return cached; // Retorna do cache, sem fazer requisição
}
```

### Detecção de Bloqueio
```typescript
if (result.error_message?.includes('Query limit exceeded') ||
    result.error_message?.includes('token blocked')) {
  // Extrai hora de desbloqueio e mostra mensagem amigável
  const until = extractUnblockTime(result.error_message);
  throw new Error(`Token bloqueado até ${until}`);
}
```

## 🚀 Melhores Práticas

### 1. Evite múltiplos testes de conexão
- ❌ **Errado**: Clicar várias vezes em "Salvar e Testar Conexão"
- ✅ **Correto**: Clicar uma vez e aguardar o resultado

### 2. Use o cache a seu favor
- Dados de inventários, pedidos e produtos são cacheados por 1 minuto
- Se fizer uma requisição e logo em seguida outra igual, a segunda será instantânea

### 3. Se receber erro de rate limit
- Aguarde o tempo indicado (geralmente 5-10 minutos)
- Não tente fazer mais requisições enquanto bloqueado
- O sistema impedirá automaticamente novas tentativas

## 🔍 Logs no Console

O sistema gera logs detalhados para debugging:

```
[API REQUEST] getInventories {...}
[CACHE HIT] abc123_getInventories_{}  // Resposta veio do cache
[API RESPONSE] getInventories: {...}
[TEST CONNECTION] Success
```

## ⚡ Performance

### Antes (sem rate limiting)
- ❌ Múltiplas requisições simultâneas
- ❌ Token bloqueado frequentemente
- ❌ Tempo de espera: 5-10 minutos quando bloqueado

### Depois (com rate limiting + cache)
- ✅ 1 requisição por segundo (máximo)
- ✅ Cache evita requisições desnecessárias
- ✅ Mensagens de erro claras e informativas
- ✅ Sem bloqueios de token em uso normal

## 🛠️ Configuração

Os seguintes parâmetros podem ser ajustados em `baselinker-api.ts`:

```typescript
private minRequestInterval = 1000; // Intervalo mínimo entre requisições (ms)
private cacheTimeout = 60000; // Tempo de cache (ms)
```

### Valores recomendados:
- **minRequestInterval**: 1000ms (1 segundo) - valor seguro para Baselinker
- **cacheTimeout**: 60000ms (1 minuto) - equilíbrio entre performance e dados atualizados

## 📊 Métodos que NÃO usam cache

Algumas operações sempre fazem requisição fresca:

1. **testConnection()** - Testa conexão real, sem cache
2. **Sync operations** - Sincronizações pegam dados atualizados

## 🐛 Troubleshooting

### "Token temporarily blocked until..."
**Problema**: Muitas requisições em pouco tempo
**Solução**: Aguarde o tempo indicado (não há como contornar)

### Cache retornando dados antigos
**Problema**: Dados com mais de 1 minuto no cache
**Solução**: O cache expira automaticamente após 60 segundos

### Requisições muito lentas
**Problema**: Rate limiting adicionando delay de 1 segundo
**Solução**: Isso é intencional e previne bloqueio do token

## 📝 Notas Técnicas

- Cache é armazenado em memória (não persiste entre reloads)
- Rate limiting funciona por instância do navegador
- Múltiplas abas compartilham a mesma instância da API
- Logs são enviados para o console do navegador

---

**Última atualização**: 2025-11-13
**Autor**: Claude Code
