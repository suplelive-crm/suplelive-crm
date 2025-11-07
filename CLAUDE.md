# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **SupleLive CRM** (also referenced as OmniCRM), a multi-tenant CRM application built for e-commerce businesses. The application integrates with WhatsApp (via Evolution API), Baselinker (e-commerce platform), n8n (automation), and OpenAI for AI-powered features. It provides customer management, order tracking, inventory management, automation workflows, and analytics.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: Radix UI + Tailwind CSS + shadcn/ui
- **State Management**: Zustand stores
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Routing**: React Router v6
- **Form Handling**: React Hook Form + Zod validation
- **Automation Builder**: ReactFlow for visual workflow editor

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build  # Runs: tsc -b && vite build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Environment Variables

Required in `.env` file:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Architecture Overview

### Multi-Tenancy

The application uses **workspace-based multi-tenancy**:
- Each user belongs to one or more workspaces
- Workspaces are the primary isolation boundary for all data
- Current workspace is managed by `workspaceStore` and persisted to localStorage
- All stores reference `currentWorkspace` for data filtering

### State Management Pattern

All state is managed through Zustand stores located in `src/store/`:

- `authStore.ts` - Authentication state and user session
- `workspaceStore.ts` - Workspace management, plans, channels, WhatsApp instances
- `crmStore.ts` - Clients, leads, campaigns, orders
- `conversationStore.ts` - Messages, conversations, inbox management
- `automationStore.ts` - Workflow builder, automation execution
- `kanbanStore.ts` - Kanban boards for sales pipeline
- `trackingStore.ts` - Purchase/transfer/return tracking for inventory
- `baselinkerStore.ts` - Baselinker integration sync
- `sectorStore.ts` - Conversation sectors/departments
- `aiAgentStore.ts` - AI agent profiles

**Key Pattern**: Stores use `useWorkspaceStore.getState().currentWorkspace` to filter data by workspace. Always check for workspace context before data operations.

### Routing & Authentication

- Routes defined in `src/App.tsx` using React Router
- `ProtectedRoute` component wraps authenticated routes
- Workspace initialization happens in `App.tsx` on user login
- Last visited route is saved to localStorage for persistence
- Users without workspaces are redirected to `/onboarding`

### Component Structure

```
src/
├── components/
│   ├── auth/           # Login, signup, protected route
│   ├── automation/     # Visual workflow builder (ReactFlow)
│   │   └── nodes/      # Custom node types (trigger, action, condition, etc.)
│   ├── campaigns/      # Campaign management
│   ├── clients/        # Client CRUD dialogs
│   ├── dashboard/      # Dashboard widgets
│   ├── inbox/          # Message inbox components
│   ├── integrations/   # Config dialogs for external services
│   ├── kanban/         # Kanban board components
│   ├── orders/         # Order management
│   ├── tracking/       # Inventory tracking (purchases/transfers/returns)
│   ├── ui/             # shadcn/ui components (DO NOT EDIT DIRECTLY)
│   └── layout/         # Sidebar, TopBar, DashboardLayout
├── pages/              # Top-level page components
├── lib/                # API clients and utilities
│   ├── supabase.ts     # Supabase client initialization
│   ├── evolution-api.ts # WhatsApp/Evolution API client
│   ├── baselinker-api.ts # Baselinker e-commerce API
│   ├── n8n-api.ts      # n8n automation webhooks
│   ├── openai-api.ts   # OpenAI integration
│   ├── tracking-api.ts # Tracking API for shipping updates
│   └── error-handler.ts # Centralized error handling with toast notifications
├── store/              # Zustand state stores
└── types/              # TypeScript type definitions
```

### Database Schema

The database uses Supabase (PostgreSQL). Key tables (see `Schema.sql`):

- **Multi-tenancy**: `workspaces`, `workspace_users`
- **CRM**: `clients`, `leads`, `orders`, `campaigns`
- **Communication**: `conversations`, `messages`, `channels`, `sectors`
- **WhatsApp**: `whatsapp_instances`
- **Automation**: `automation_workflows`, `automation_triggers`, `automation_actions`, `automation_conditions`, `automation_executions`, `automation_templates`
- **Kanban**: `kanban_boards`, `kanban_stages`, `kanban_client_assignments`
- **Inventory**: `products`, `purchases`, `purchase_products`, `transfers`, `transfer_products`, `returns`
- **Integrations**: `baselinker_sync`
- **AI**: `ai_agents`

### External Integrations

#### Evolution API (WhatsApp)
- Managed in `src/lib/evolution-api.ts`
- Instances are created/managed via `workspaceStore`
- Webhook endpoint: `supabase/functions/evolution-webhook/index.ts`
- Status syncing handled by store actions

#### Baselinker (E-commerce)
- Integration in `src/lib/baselinker-api.ts`
- Proxy function: `supabase/functions/baselinker-proxy/index.ts`
- Sync function: `supabase/functions/baselinker-sync/index.ts`
- Syncs orders, customers, inventory to local database

#### n8n (Automation)
- Client in `src/lib/n8n-api.ts`
- Workflows can trigger n8n webhooks
- Used for advanced automation scenarios

#### OpenAI
- Client in `src/lib/openai-api.ts`
- Powers AI agents in automation workflows
- Used for chatbot nodes and classifiers

### Automation System

The automation builder uses **ReactFlow** for visual workflow creation:

- **Node Types**: trigger, action, condition, delay, webhook, chatbot, classifier, agent
- **Node Components**: Located in `src/components/automation/nodes/`
- **Workflow Data**: Stored as JSONB in `automation_workflows.workflow_data`
- **Execution**: Tracked in `automation_executions` table
- **Templates**: Pre-built workflows in `automation_templates`

**Visual Builder**: `AutomationBuilder.tsx` renders the canvas, node toolbar, and config panels.

### Error Handling

Use the centralized `ErrorHandler` from `src/lib/error-handler.ts`:
- `ErrorHandler.handleAsync()` - Wraps async operations with try-catch
- `ErrorHandler.showError()` - Display error toast
- `ErrorHandler.showSuccess()` - Display success toast
- Integrates with `sonner` toast library

## Path Aliases

The project uses `@/` as an alias for `src/`:
```typescript
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
```

## Important Patterns

### Fetching Data in Stores
Always check for `currentWorkspace` before fetching:
```typescript
const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
if (!currentWorkspace) throw new Error('No workspace selected');

const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('workspace_id', currentWorkspace.id);
```

### Creating Records
Include `workspace_id` in all workspace-scoped inserts:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert({
    ...recordData,
    workspace_id: currentWorkspace.id,
  });
```

### React Hook Form + Zod
Forms use `react-hook-form` with `@hookform/resolvers/zod`:
```typescript
const form = useForm<FormSchema>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});
```

### shadcn/ui Components
UI components in `src/components/ui/` are generated by shadcn/ui. To add new components:
```bash
npx shadcn-ui@latest add [component-name]
```

## Supabase Edge Functions

Located in `supabase/functions/`:
- `evolution-webhook` - Receives WhatsApp events from Evolution API
- `baselinker-proxy` - Proxies requests to Baselinker API (handles auth)
- `baselinker-sync` - Background job to sync Baselinker data
- `tracking-automation` - Automated tracking status updates
- `register-user` - User registration with workspace assignment

## Background Jobs & n8n Migration

The project is transitioning from n8n workflows to a native **event-driven architecture**. See `Briefing/EVENT_DRIVEN_ARCHITECTURE.md` for the complete strategy (recommended) and `Briefing/MIGRATION_PLAN.md` for the legacy cron-based approach.

### Current n8n Workflows (To Be Migrated)

Located in `Briefing/` directory:

**Baselinker Synchronization** (Critical - runs every 10 min):
- `Plataforma___Receber_pedidos__Sinc__.json` - Sync orders from Baselinker
- `Plataforma___Sincronizar_Estoque.json` - Sync product inventory
- `Plataforma___Sincroniza__o_clientes.json` - Sync/create clients from orders
- `Plataforma___Sincronizar_Devolu__es.json` - Sync returns

**Inventory Management**:
- `Plataforma___Subir_estoque_produtos_novos.json` - Update stock for new products
- `Plataforma___Subir_estoque_transferencia.json` - Process stock transfers between warehouses (ES/SP)

**Tracking & Notifications**:
- `Plataforma___Atualizar_Encomendas.json` - Update tracking status via shipping APIs
- `Plataforma___Mensagem_itens_chegou_atacado.json` - Notify when wholesale items arrive

**Marketing Automation**:
- `Agente___Mensagem_de_Recompra.json` - Send reorder reminders based on product duration
- `Agente___Venda_Casada.json` - Suggest upsell/cross-sell products

**External Integrations**:
- `Enviar_contato_para_chatwoot.json` - Sync contacts to Chatwoot

### Migration Architecture (Event-Driven)

The plan is to migrate these workflows to an **event-driven architecture**:
1. **Baselinker Event Polling** - Edge Function polls `getJournalList` every 30s-1min
2. **Event Queue** - Database table stores events to process
3. **Database Triggers** - Auto-invoke Edge Functions when events arrive
4. **Event Processors** - Specific handlers for each event type (order_created, payment_received, etc.)
5. **Business Logic Triggers** - Immediate actions (welcome message, upsell) + scheduled actions (reorder reminders)

**Key Concept**: Actions happen **immediately** when events occur (new order → instant message), not on cron intervals.

Key benefits:
- ⚡ Real-time processing (seconds, not minutes)
- 💰 Cost reduction (process only what's needed)
- 🔄 Automatic retry on failures
- 📊 Full event traceability
- 🎯 No missed events between polling

### Event-Driven Tables (To Be Created)

```sql
-- Event queue for async processing
CREATE TABLE event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_log_id BIGINT UNIQUE NOT NULL,
  event_type INTEGER NOT NULL,
  event_name TEXT,
  order_id BIGINT,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Track Baselinker sync position
CREATE TABLE baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) UNIQUE,
  last_log_id BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false
);

-- Scheduled messages (reorders, follow-ups)
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  client_id UUID REFERENCES clients(id),
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb
);
```

### When Working with Events & Background Jobs

1. **For new automation**: Use event-driven patterns with database triggers
2. **Event naming**: Use `event_name` like `order_created`, `payment_received`, `status_changed`
3. **Immediate actions**: Trigger directly from event processor (welcome message, upsell)
4. **Scheduled actions**: Insert into `scheduled_messages` table (reorder reminders)
5. **Idempotency**: Use `event_log_id` UNIQUE constraint to prevent duplicate processing
6. **Retry logic**: Failed events stay in queue with incremented `retry_count`
7. **Baselinker events**: Use `getJournalList` API for real-time sync (21 event types)
8. **Database triggers**: Use PostgreSQL triggers to auto-invoke Edge Functions on data changes

## Common Development Workflows

### Adding a New Store
1. Create `src/store/[name]Store.ts`
2. Define state interface with actions
3. Use Zustand `create()` pattern
4. Reference `currentWorkspace` for multi-tenancy
5. Use `ErrorHandler.handleAsync()` for async operations

### Adding a New Page
1. Create `src/pages/[Name]Page.tsx`
2. Add route in `src/App.tsx` with `<ProtectedRoute>`
3. Add navigation link in `src/components/layout/Sidebar.tsx`
4. Ensure workspace check: `if (!currentWorkspace) return <Navigate to="/onboarding" />`

### Creating an Automation Node Type
1. Create node component in `src/components/automation/nodes/[NodeType]Node.tsx`
2. Register in `nodeTypes` object in `AutomationBuilder.tsx`
3. Add configuration panel in `NodeConfigPanel.tsx`
4. Update `WorkflowNode` type in `src/types/index.ts`

### Adding an Integration
1. Create API client in `src/lib/[integration]-api.ts`
2. Add config dialog in `src/components/integrations/[Integration]ConfigDialog.tsx`
3. Store credentials in `workspaces.settings` JSONB column
4. Add integration card to `src/pages/IntegrationsPage.tsx`

## Testing External Webhooks Locally

Use tools like ngrok to expose local Supabase functions:
```bash
npx supabase functions serve
ngrok http 54321
```

## Project-Specific Terminology

- **Workspace**: Multi-tenant container for all data
- **Instance**: WhatsApp connection instance (Evolution API)
- **Channel**: Communication channel (WhatsApp, future: Instagram, Facebook)
- **Sector**: Department/category for conversation routing
- **Automation Workflow**: Visual automation created with ReactFlow
- **Kanban Board**: Sales pipeline board with stages and client cards
- **Tracking**: Inventory management for purchases, transfers, returns
