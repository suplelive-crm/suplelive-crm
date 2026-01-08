# Deploy Edge Functions via Supabase Dashboard

## Overview

This guide explains how to deploy the Edge Functions for the advanced phone validation system using the Supabase Dashboard (without Docker).

## Why This Method?

The Supabase CLI requires Docker Desktop to bundle Edge Functions. Since Docker is not available, we're using the Dashboard with consolidated single-file versions.

## Functions to Deploy

1. **validate-whatsapp-number** - Validates phone numbers in WhatsApp
2. **process-order-created** - Processes new orders with phone validation

## Prerequisites

✅ Supabase project created (your project ref: `oqwstanztqdiexgrpdta`)
✅ Access to Supabase Dashboard at https://supabase.com/dashboard
✅ Database tables created (clients, orders, whatsapp_instances, etc.)
✅ Workspace settings configured (Baselinker, GhostAPI)

## Deployment Order

**IMPORTANT**: Deploy in this order, as `process-order-created` calls `validate-whatsapp-number`.

---

## Step 1: Deploy validate-whatsapp-number

### 1.1 Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project: `oqwstanztqdiexgrpdta`
3. Click **Edge Functions** in the left sidebar
4. Click **Create a new function** button

### 1.2 Create Function

1. **Function name**: `validate-whatsapp-number`
2. Click **Create function**

### 1.3 Copy Function Code

1. Open the file in your project:
   ```
   supabase/functions/validate-whatsapp-number/index.ts
   ```

2. Copy the **ENTIRE contents** (all 126 lines)

3. Paste into the Supabase Dashboard editor

### 1.4 Deploy

1. Click **Deploy** button
2. Wait for deployment to complete (usually 10-20 seconds)
3. ✅ You should see "Function deployed successfully"

### 1.5 Verify

Check the **Logs** tab - you should see the function is ready.

---

## Step 2: Deploy process-order-created

### 2.1 Create Function

1. In **Edge Functions**, click **Create a new function**
2. **Function name**: `process-order-created`
3. Click **Create function**

### 2.2 Copy Consolidated Code

**IMPORTANT**: Use the consolidated version!

1. Open the file in your project:
   ```
   supabase/functions/process-order-created/index-consolidated.ts
   ```

2. Copy the **ENTIRE contents** (all ~1000 lines)
   - Make sure you copy from the very first line to the very last line
   - This file contains all dependencies in a single file

3. Paste into the Supabase Dashboard editor

### 2.3 Deploy

1. Click **Deploy** button
2. Wait for deployment to complete (may take 20-30 seconds due to file size)
3. ✅ You should see "Function deployed successfully"

### 2.4 Verify

Check the **Logs** tab - you should see the function is ready.

---

## Step 3: Test the Deployment

### 3.1 Test validate-whatsapp-number

Go to the **Invoke** tab of `validate-whatsapp-number` and test with:

```json
{
  "phone": "5527999999999",
  "instanceId": "YOUR_WHATSAPP_INSTANCE_ID"
}
```

Expected response:
```json
{
  "exists": true,
  "name": "João Silva",
  "phone": "5527999999999",
  "verified": true
}
```

### 3.2 Test process-order-created

Go to the **Invoke** tab of `process-order-created` and test with a real order:

```json
{
  "event": {
    "order_id": 12345,
    "workspace_id": "YOUR_WORKSPACE_UUID"
  }
}
```

Expected response:
```json
{
  "success": true,
  "order_id": "uuid",
  "client_id": "uuid",
  "client_is_new": true
}
```

---

## Step 4: Monitor Logs

After deployment, monitor the execution:

### 4.1 Check Function Logs

1. Go to **Edge Functions** → `process-order-created`
2. Click **Logs** tab
3. Look for these key messages:

**Phone Validation (Success)**:
```
⚠️ Pedido sem telefone - Iniciando busca no GhostAPI + validação WhatsApp
Consultando GhostAPI para CPF: 12345678901
GhostAPI retornou 2 telefone(s)
Validando telefone no WhatsApp: 5527999999999
Similaridade de nome: 85%
✅ Telefone validado encontrado: 5527999999999
✅ Sent welcome message to 5527999999999
✅ Sent upsell message to 5527999999999
✅ Scheduled reorder message for SKU123
```

**Phone Validation (No Valid Phone)**:
```
⚠️ Pedido sem telefone - Iniciando busca no GhostAPI + validação WhatsApp
Consultando GhostAPI para CPF: 12345678901
GhostAPI retornou 2 telefone(s)
Validando telefone no WhatsApp: 5527988888888
❌ Telefone rejeitado (score < 60 - nome muito diferente)
❌ Nenhum telefone válido encontrado - Cliente será criado SEM telefone
⚠️ Cliente criado sem telefone - Mensagem de boas-vindas NÃO enviada
```

---

## Verification Checklist

After deployment, verify:

- [ ] Both functions show as "Active" in Dashboard
- [ ] No errors in function logs
- [ ] Test invocations return expected responses
- [ ] Database records are created correctly
- [ ] Phone validation metadata is stored in `clients.metadata.phone_validation`
- [ ] Messages are sent when valid phone exists
- [ ] Messages are NOT sent when no valid phone
- [ ] Scheduled messages are created in `scheduled_messages` table
- [ ] `orders.mensagem_enviada` is updated to `true`
- [ ] `orders_products.mensagem_recompra` is updated to `true`

---

## What This System Does

### Phone Validation Flow

```
New Order Arrives (no phone in order)
    ↓
Has CPF?
    ↓ Yes
Search CPF in GhostAPI
    ↓
Found phones: [27999999999, 27988888888]
    ↓
Validate each in WhatsApp (Evolution API)
    ↓
Phone 1: Exists ✅ (name: "João Silva Santos")
Phone 2: Not exists ❌
    ↓
Calculate name similarity:
  Order name: "João Silva"
  WhatsApp name: "João Silva Santos"
  Similarity: 85%
    ↓
Calculate score:
  50 (WhatsApp valid) + (85 / 2) = 92.5
    ↓
Score >= 60? ✅ YES
    ↓
Register client with validated phone
Send welcome message ✅
Send upsell message ✅
```

### Security Features

1. **Double Validation**:
   - First validation: Phone exists in WhatsApp ✅
   - Second validation: Name similarity >= 20% ✅

2. **Score System**:
   - Base score: 50 points (WhatsApp exists)
   - Bonus: Up to 50 points (name similarity)
   - Minimum required: 60 points

3. **Fail-Safe**:
   - If no valid phone → Client created WITHOUT phone
   - No messages sent to invalid phones
   - All validation metadata stored for audit

---

## Troubleshooting

### Function Not Deploying

**Problem**: Deploy button disabled or error message appears

**Solutions**:
1. Make sure you copied the **entire file** (check first and last lines)
2. Check for copy/paste errors (missing characters)
3. Refresh the page and try again
4. Check browser console for errors (F12)

### Phone Validation Not Working

**Problem**: Function runs but no phone validation happens

**Check**:
1. Is `validate-whatsapp-number` deployed? ✅
2. Is GhostAPI configured in `workspaces.settings`?
   ```sql
   SELECT settings->'ghost_api' FROM workspaces WHERE id = 'YOUR_WORKSPACE_ID';
   ```
3. Is WhatsApp instance connected?
   ```sql
   SELECT status FROM whatsapp_instances WHERE workspace_id = 'YOUR_WORKSPACE_ID';
   ```

### Messages Not Sent

**Problem**: Client created but no messages sent

**Check**:
1. Does client have valid phone?
   ```sql
   SELECT phone, metadata FROM clients WHERE id = 'CLIENT_ID';
   ```
2. Check `metadata.phone_validation.validated` should be `true`
3. Check Evolution API credentials in function logs
4. Verify WhatsApp instance has `session_id`

### GhostAPI Returns No Phones

**Problem**: GhostAPI search returns empty array

**Check**:
1. Is CPF correctly extracted from order?
2. Is GhostAPI API key valid?
3. Check GhostAPI logs (if available)
4. Test GhostAPI directly with cURL:
   ```bash
   curl -X POST https://ghostapi.url/consulta/cpf \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"cpf":"12345678901"}'
   ```

---

## Database Schema Requirements

### clients.metadata Structure

```json
{
  "phone_validation": {
    "validated": true,
    "source": "ghost_api_whatsapp",
    "validated_at": "2026-01-08T10:30:00Z"
  }
}
```

OR (if no valid phone):

```json
{
  "phone_validation": {
    "validated": false,
    "reason": "no_valid_phone_found"
  }
}
```

### scheduled_messages Table

Make sure this table exists:

```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  client_id UUID REFERENCES clients(id),
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Next Steps

After successful deployment:

1. ✅ **Test with real orders** from Baselinker
2. ✅ **Monitor logs** for the first few orders
3. ✅ **Verify phone validation** is working correctly
4. ✅ **Check client records** have validation metadata
5. ✅ **Implement scheduled message processor** (separate Edge Function to send messages from `scheduled_messages` table)
6. ✅ **Set up Baselinker webhook** to trigger `process-order-created` on new orders

---

## Support

If you encounter issues:

1. Check function logs in Supabase Dashboard
2. Review deployment instructions in this file
3. Verify all prerequisites are met
4. Check database schema and data
5. Review individual function `DEPLOY_INSTRUCTIONS.md` files:
   - `supabase/functions/validate-whatsapp-number/DEPLOY_INSTRUCTIONS.md`
   - `supabase/functions/process-order-created/DEPLOY_INSTRUCTIONS.md`

---

## Files Reference

### Deployment Files
- `supabase/functions/validate-whatsapp-number/index.ts` (126 lines) - Single file, ready to deploy
- `supabase/functions/process-order-created/index-consolidated.ts` (~1000 lines) - Consolidated version for Dashboard

### Documentation Files
- `VALIDACAO_TELEFONE_GHOST_WHATSAPP.md` - Complete system documentation
- `supabase/functions/validate-whatsapp-number/DEPLOY_INSTRUCTIONS.md` - Specific deployment guide
- `supabase/functions/process-order-created/DEPLOY_INSTRUCTIONS.md` - Specific deployment guide

### Original Modular Files (NOT for Dashboard deployment)
- `supabase/functions/process-order-created/index.ts` - Uses local imports
- `supabase/functions/process-order-created/validate-client-data.ts` - Imported by index.ts
- `supabase/functions/_shared/*.ts` - Shared helpers

**Note**: The modular files are the source code. The consolidated version is generated from these for Dashboard deployment.
