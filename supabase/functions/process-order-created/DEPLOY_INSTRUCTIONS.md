# Deploy Instructions: process-order-created

## Deployment via Supabase Dashboard

### Step 1: Deploy validate-whatsapp-number (Prerequisite)

Before deploying this function, you MUST deploy `validate-whatsapp-number` first, as this function calls it.

1. Go to **Edge Functions** in Supabase Dashboard
2. Create function named: `validate-whatsapp-number`
3. Copy contents from: `supabase/functions/validate-whatsapp-number/index.ts`
4. Deploy

### Step 2: Deploy process-order-created

1. Go to **Edge Functions** in Supabase Dashboard
2. Click **Create a new function**
3. Name it: `process-order-created`
4. Copy the **ENTIRE contents** of `index-consolidated.ts` from this directory
5. Paste into the editor
6. Click **Deploy**

## Important Notes

### File to Use for Deployment

**USE THIS FILE**: `index-consolidated.ts`

This consolidated version includes all dependencies in a single file:
- ✅ Baselinker API helpers
- ✅ Workspace config helpers
- ✅ Message templates
- ✅ WhatsApp sender
- ✅ Phone validation (GhostAPI + WhatsApp)
- ✅ All helper functions

**DO NOT USE**: `index.ts` (requires local imports that don't work in Dashboard)

### What This Function Does

When a new order is created in Baselinker, this function:

1. **Creates/Finds Client**:
   - Search by CPF first
   - If not found, search by phone
   - If client doesn't exist, create new client

2. **Advanced Phone Validation** (NEW FEATURE):
   - If order has NO phone but HAS CPF:
     - Search CPF in GhostAPI for phone numbers
     - Validate each phone in WhatsApp (Evolution API)
     - Calculate name similarity (Levenshtein Distance)
     - Accept only phones with score >= 60 (WhatsApp valid + name similar)
   - If no valid phone found, create client WITHOUT phone
   - Stores validation metadata in `clients.metadata.phone_validation`

3. **Creates Order**:
   - Create order record in database
   - Link to client
   - Store metadata

4. **Creates Order Products**:
   - Insert all products from the order
   - Calculate taxes and prices

5. **Sends Upsell Message** (Immediate):
   - Offer second unit with 20% discount
   - Only if client has valid phone
   - Updates `orders.mensagem_enviada = true`

6. **Schedules Reorder Messages**:
   - Based on product duration
   - Scheduled for (order_date + duration - 15 days)
   - Inserts into `scheduled_messages` table
   - Updates `orders_products.mensagem_recompra = true`

7. **Updates Client Stats**:
   - Total spent
   - Total orders
   - Last update timestamp

## Testing

### Invoke via Supabase Client

```typescript
const { data, error } = await supabase.functions.invoke('process-order-created', {
  body: {
    event: {
      order_id: 12345,
      workspace_id: 'uuid-of-workspace'
    }
  }
});
```

### Test with cURL

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-order-created \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":{"order_id":12345,"workspace_id":"uuid-here"}}'
```

## Required Database Tables

Ensure these tables exist:
- ✅ `workspaces` - with `settings` JSONB column
- ✅ `clients` - with `metadata` JSONB column
- ✅ `orders` - with `mensagem_enviada` boolean column
- ✅ `orders_products` - with `mensagem_recompra` boolean column
- ✅ `whatsapp_instances` - with `status` and `session_id`
- ✅ `products` - with `duracao` (duration in days)
- ✅ `scheduled_messages` - for reorder reminders
- ✅ `messages` - for message log
- ✅ `message_templates` - optional (uses defaults if not found)

## Required Workspace Settings

In `workspaces.settings` JSONB:

```json
{
  "baselinker": {
    "token": "YOUR_BASELINKER_TOKEN",
    "enabled": true
  },
  "ghost_api": {
    "api_key": "YOUR_GHOST_API_KEY",
    "base_url": "https://ghostapi.url",
    "enabled": true
  }
}
```

## Environment Variables

Automatically available in Supabase Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Monitoring

Check logs in Supabase Dashboard:
1. Go to **Edge Functions**
2. Click on `process-order-created`
3. Go to **Logs** tab
4. Look for:
   - ✅ `Telefone validado encontrado`
   - ❌ `Nenhum telefone válido encontrado`
   - ✅ `Sent welcome message`
   - ✅ `Sent upsell message`
   - ✅ `Scheduled reorder message`

## Troubleshooting

### Function fails to deploy
- Make sure you copied the **ENTIRE** file (it's ~1000 lines)
- Check for any copy/paste errors

### Phone validation not working
1. Check if `validate-whatsapp-number` function is deployed
2. Verify GhostAPI config in `workspaces.settings`
3. Check if WhatsApp instance is connected (`status = 'connected'`)

### Messages not sent
1. Check if client has valid phone
2. Verify WhatsApp instance has `session_id`
3. Check Evolution API credentials in whatsapp-sender.ts

### Reorder messages not scheduled
1. Check if product has `duracao` field set
2. Verify `scheduled_messages` table exists
3. Check if calculated date is in the future

## Next Steps After Deployment

1. ✅ Deploy both functions
2. ✅ Test with a real order from Baselinker
3. ✅ Monitor logs for phone validation
4. ✅ Check if messages are sent
5. ✅ Verify scheduled_messages are created
6. ✅ Implement scheduled message sender (separate Edge Function to process `scheduled_messages` table)
