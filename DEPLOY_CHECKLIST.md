# 🚀 Deployment Checklist - Complete System

## Overview

This checklist covers all pending deployments and database migrations for the SupleLive CRM system.

**Last Updated**: 2026-01-08

---

## 📋 Deployment Tasks

### ✅ COMPLETED IN THIS SESSION

- [x] Created consolidated Edge Functions for Dashboard deployment
- [x] Created complete deployment documentation
- [x] Prepared phone validation system (GhostAPI + WhatsApp)
- [x] Fixed RLS schema cache issues (RPC functions created)
- [x] Simplified user management (removed invite system)

### 🔴 PENDING DEPLOYMENT

#### 1. Database Migration (RPC Functions)

**File**: `supabase/migrations/20260108_create_get_workspace_users_with_details.sql`

**Action Required**: Execute in Supabase SQL Editor

**Steps**:
1. Go to Supabase Dashboard → SQL Editor
2. Open `20260108_create_get_workspace_users_with_details.sql`
3. Copy entire contents
4. Paste in SQL Editor
5. Click **Run**
6. Verify success message appears

**What it does**:
- Creates `get_workspace_users_with_details()` RPC function
- Creates `get_user_invitations_with_details()` RPC function
- Fixes schema cache errors with workspace_users
- Allows frontend to fetch users with email/name from auth.users

**Status**: ⏳ READY TO EXECUTE

---

#### 2. Edge Function: validate-whatsapp-number

**File**: `supabase/functions/validate-whatsapp-number/index.ts`

**Action Required**: Deploy via Supabase Dashboard

**Steps**:
1. Go to Supabase Dashboard → Edge Functions
2. Create new function: `validate-whatsapp-number`
3. Copy code from `index.ts` (126 lines)
4. Deploy

**What it does**:
- Validates phone numbers in WhatsApp
- Returns phone existence and user name
- Used by process-order-created for validation

**Status**: ⏳ READY TO DEPLOY

---

#### 3. Edge Function: process-order-created

**File**: `supabase/functions/process-order-created/index-consolidated.ts`

**Action Required**: Deploy via Supabase Dashboard

**Steps**:
1. Go to Supabase Dashboard → Edge Functions
2. Create new function: `process-order-created`
3. Copy code from `index-consolidated.ts` (~1000 lines)
4. Deploy

**Prerequisites**:
- ✅ `validate-whatsapp-number` must be deployed first

**What it does**:
- Processes new orders from Baselinker
- Validates phone numbers (GhostAPI + WhatsApp)
- Creates clients with validated phones
- Sends welcome and upsell messages
- Schedules reorder reminders

**Status**: ⏳ READY TO DEPLOY (after validate-whatsapp-number)

---

## 📝 Deployment Order

**CRITICAL**: Execute in this exact order:

```
1. Database Migration (RPC functions)
   ↓
2. validate-whatsapp-number (Edge Function)
   ↓
3. process-order-created (Edge Function)
   ↓
4. Test system end-to-end
```

---

## 🧪 Testing Checklist

After each deployment:

### After RPC Migration

- [ ] Execute migration in SQL Editor
- [ ] Check for success message
- [ ] Test RPC call:
  ```sql
  SELECT * FROM get_workspace_users_with_details('YOUR_WORKSPACE_ID');
  ```
- [ ] Verify users are returned with email and name

### After validate-whatsapp-number

- [ ] Function shows as "Active" in Dashboard
- [ ] Test invoke with sample data
- [ ] Check logs for successful execution
- [ ] Verify response format matches expected structure

### After process-order-created

- [ ] Function shows as "Active" in Dashboard
- [ ] Test invoke with test order
- [ ] Check logs for:
  - Phone validation attempts
  - GhostAPI calls
  - WhatsApp validation
  - Message sending
  - Database updates
- [ ] Verify client created with correct phone/metadata
- [ ] Verify messages sent (if valid phone)
- [ ] Verify scheduled_messages created

---

## 📊 Database Requirements

### Tables That Must Exist

Before deploying Edge Functions, verify these tables exist:

- [x] `workspaces` - with `settings` JSONB column
- [x] `workspace_users` - for user management
- [x] `clients` - with `metadata` JSONB column
- [x] `orders` - with `mensagem_enviada` boolean
- [x] `orders_products` - with `mensagem_recompra` boolean
- [x] `whatsapp_instances` - with `status` and `session_id`
- [x] `products` - with `duracao` field
- [x] `messages` - for message logging
- [ ] `scheduled_messages` - for reorder reminders
- [ ] `message_templates` - optional (uses defaults if not exists)

### Missing Tables (CREATE IF NEEDED)

If `scheduled_messages` doesn't exist, create it:

```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_scheduled_messages_scheduled_for
  ON scheduled_messages(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX idx_scheduled_messages_workspace_status
  ON scheduled_messages(workspace_id, status);

-- RLS policies
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scheduled messages in their workspace"
  ON scheduled_messages FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert scheduled messages"
  ON scheduled_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update scheduled messages"
  ON scheduled_messages FOR UPDATE
  USING (true);
```

---

## ⚙️ Configuration Requirements

### Workspace Settings

Verify `workspaces.settings` contains:

```sql
-- Check Baselinker config
SELECT
  id,
  name,
  settings->'baselinker'->'token' as baselinker_token,
  settings->'baselinker'->'enabled' as baselinker_enabled
FROM workspaces;

-- Check GhostAPI config
SELECT
  id,
  name,
  settings->'ghost_api'->'api_key' as ghost_api_key,
  settings->'ghost_api'->'base_url' as ghost_api_url,
  settings->'ghost_api'->'enabled' as ghost_api_enabled
FROM workspaces;
```

If missing, update:

```sql
UPDATE workspaces
SET settings = settings || jsonb_build_object(
  'baselinker', jsonb_build_object(
    'token', 'YOUR_BASELINKER_TOKEN',
    'enabled', true
  ),
  'ghost_api', jsonb_build_object(
    'api_key', 'YOUR_GHOST_API_KEY',
    'base_url', 'https://your-ghost-api.url',
    'enabled', true
  )
)
WHERE id = 'YOUR_WORKSPACE_ID';
```

### WhatsApp Instances

Verify active instances:

```sql
SELECT
  id,
  workspace_id,
  session_id,
  status,
  evolution_url,
  evolution_api_key
FROM whatsapp_instances
WHERE status = 'connected';
```

Must have at least one instance with:
- `status = 'connected'`
- `session_id` not null
- `evolution_url` configured
- `evolution_api_key` configured

---

## 📖 Documentation Reference

### Main Guides

1. **DEPLOYMENT_READY.md** - Quick overview and status
2. **DEPLOY_EDGE_FUNCTIONS_DASHBOARD.md** - Complete deployment guide
3. **VALIDACAO_TELEFONE_GHOST_WHATSAPP.md** - Phone validation system docs
4. **CORRIGIR_ERRO_SCHEMA_CACHE.md** - RPC functions explanation

### Function-Specific

- `supabase/functions/validate-whatsapp-number/DEPLOY_INSTRUCTIONS.md`
- `supabase/functions/process-order-created/DEPLOY_INSTRUCTIONS.md`

---

## 🔍 Verification Commands

### Check RPC Functions

```sql
-- List all RPC functions
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%workspace%';
```

### Check Edge Functions

Via Supabase Dashboard:
1. Go to Edge Functions
2. Verify both functions show as "Active"
3. Check "Invocations" count increases
4. Monitor "Logs" for errors

### Check Phone Validation

```sql
-- Check clients with validation metadata
SELECT
  id,
  name,
  phone,
  cpf,
  metadata->'phone_validation' as phone_validation
FROM clients
WHERE metadata->'phone_validation' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Check Scheduled Messages

```sql
-- Check pending scheduled messages
SELECT
  id,
  client_id,
  message_type,
  scheduled_for,
  status,
  created_at
FROM scheduled_messages
WHERE status = 'pending'
ORDER BY scheduled_for ASC;
```

---

## 🚨 Rollback Plan

If something goes wrong:

### Edge Functions

1. Go to Dashboard → Edge Functions
2. Click on function name
3. Go to "Versions" tab
4. Rollback to previous version
5. Or delete function if needed

### Database Migration

RPC functions are safe to re-run (uses `CREATE OR REPLACE`).

To remove if needed:

```sql
DROP FUNCTION IF EXISTS get_workspace_users_with_details(UUID);
DROP FUNCTION IF EXISTS get_user_invitations_with_details(UUID);
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: RPC function not found
- **Solution**: Execute migration again, check for errors in SQL Editor

**Issue**: Edge Function deployment fails
- **Solution**: Verify entire file was copied, check for copy/paste errors

**Issue**: Phone validation not working
- **Solution**: Check GhostAPI config, verify WhatsApp instance connected

**Issue**: Messages not sent
- **Solution**: Check Evolution API credentials, verify phone is valid

### Logs to Check

1. **Edge Function Logs**: Dashboard → Edge Functions → Function Name → Logs
2. **Database Logs**: Dashboard → Database → Logs
3. **Auth Logs**: Dashboard → Authentication → Logs

---

## ✅ Final Checklist

Before marking deployment complete:

- [ ] RPC migration executed successfully
- [ ] Both Edge Functions deployed and active
- [ ] Test invocations return expected results
- [ ] Phone validation executes correctly
- [ ] Messages are sent to valid phones
- [ ] Scheduled messages are created
- [ ] Database fields updated correctly
- [ ] Logs show no errors
- [ ] Monitoring set up
- [ ] Documentation reviewed
- [ ] Team notified of new features

---

## 🎉 Next Steps After Deployment

1. **Monitor First Orders**
   - Watch logs for first few orders
   - Verify phone validation works
   - Check message delivery

2. **Set Up Monitoring**
   - Create alerts for Edge Function errors
   - Monitor scheduled_messages processing
   - Track validation success rate

3. **Implement Scheduled Message Processor**
   - Create Edge Function to process `scheduled_messages`
   - Schedule via cron or database trigger
   - Send messages at scheduled time

4. **Connect Baselinker Webhook**
   - Configure Baselinker to call `process-order-created`
   - Test with real orders
   - Monitor end-to-end flow

5. **Optimize & Iterate**
   - Review validation score threshold (currently 60)
   - Adjust name similarity algorithm if needed
   - Add more phone validation sources if needed

---

**Deployment Status**: 🟡 PENDING

**Ready to Deploy**: ✅ YES

**Estimated Time**: 30-45 minutes

**Risk Level**: 🟢 LOW (can rollback if needed)

---

## 📝 Deployment Log

Track your deployment progress:

```
Date: _________
Time Started: _________

✅ Task 1: RPC Migration
   Executed at: _________
   Status: _________
   Notes: _________

✅ Task 2: validate-whatsapp-number
   Deployed at: _________
   Status: _________
   Notes: _________

✅ Task 3: process-order-created
   Deployed at: _________
   Status: _________
   Notes: _________

✅ Testing
   Completed at: _________
   Status: _________
   Issues: _________

Time Completed: _________
Total Duration: _________
Deployed By: _________
```

---

**Created**: 2026-01-08
**Version**: 1.0
**Status**: Ready for Deployment
