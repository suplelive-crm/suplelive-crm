# 🔑 Gerar Supabase Access Token

Para fazer deploy via CLI sem Docker, precisamos de um Access Token.

---

## 📋 Passo a Passo

### **1. Acessar Account Settings**

1. Acesse: https://supabase.com/dashboard/account/tokens
2. Ou: Dashboard → Clique no seu avatar (canto superior direito) → **"Account Settings"**
3. No menu lateral, clique em **"Access Tokens"**

### **2. Criar Novo Token**

1. Clique em **"Generate new token"** ou **"Create new token"**
2. **Token name**: Digite algo como `CLI Deploy` ou `Local Development`
3. **Expiration**: Escolha a validade (pode ser "Never" para não expirar)
4. Clique em **"Generate token"**

### **3. Copiar Token**

⚠️ **IMPORTANTE**: O token só será mostrado UMA VEZ!

1. Copie o token que aparece (começa com `sbp_...`)
2. **Guarde em local seguro** (vou precisar dele)
3. **NÃO compartilhe publicamente**

### **4. Me Enviar o Token**

Cole o token aqui no chat para eu usar no deploy.

**Exemplo de token**:
```
sbp_1234567890abcdefghijklmnopqrstuvwxyz...
```

---

## ⚡ Depois que eu tiver o token:

```bash
# 1. Fazer login com token
npx supabase login --token sbp_SEU_TOKEN_AQUI

# 2. Link ao projeto
npx supabase link --project-ref oqwstanztqdiexgrpdta

# 3. Deploy todas as funções
npx supabase functions deploy validate-whatsapp-number
npx supabase functions deploy process-order-created

# 4. Verificar deploy
npx supabase functions list
```

---

## 🔒 Segurança

- ✅ Token permite deploy de Edge Functions
- ✅ Token pode ser revogado a qualquer momento
- ✅ Use token com escopo limitado se possível
- ⚠️ Não commite o token no Git
- ⚠️ Não compartilhe em lugares públicos

---

**Me envie o token quando tiver pronto!** 🚀
