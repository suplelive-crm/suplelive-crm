# Deploy Instructions: validate-whatsapp-number

## Deployment via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** in the sidebar
3. Click **Create a new function**
4. Name it: `validate-whatsapp-number`
5. Copy the entire contents of `index.ts` from this directory
6. Paste into the editor
7. Click **Deploy**

## Function Details

- **Purpose**: Validates phone numbers in WhatsApp via Evolution API
- **Method**: POST
- **Request Body**:
  ```json
  {
    "phone": "5527999999999",
    "instanceId": "uuid-of-whatsapp-instance"
  }
  ```
- **Response**:
  ```json
  {
    "exists": true,
    "name": "João Silva",
    "phone": "5527999999999",
    "verified": true
  }
  ```

## Testing

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/validate-whatsapp-number \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"5527999999999","instanceId":"YOUR_INSTANCE_ID"}'
```

## Notes

- This function is a single file with no dependencies
- Ready for deployment as-is
- Uses Supabase service role key (automatically available in Edge Functions)
