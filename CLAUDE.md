# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Type-check (tsc -b) then production build (vite build)
npm run lint     # ESLint over the whole project
npm run preview  # Preview the production build
```

There is **no test runner** configured. `npm run build` is the correctness gate: TypeScript runs with `strict`, `noUnusedLocals`, and `noUnusedParameters`, so unused variables/imports fail the build, not just lint.

Supabase Edge Functions live in `supabase/functions/` (Deno runtime) and are deployed with the Supabase CLI (a dev dependency): `npx supabase functions deploy <name>`. Migrations are in `supabase/migrations/`.

## Environment

Requires a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `src/lib/supabase.ts` throws on startup if either is missing. The UI is written in **Brazilian Portuguese** — match that language for any user-facing strings and toasts.

## Architecture

A multi-tenant CRM (WhatsApp inbox, clients, kanban, orders, campaigns, package tracking, automations) built with Vite + React 18 + TypeScript, Tailwind + shadcn/ui (new-york style, components in `src/components/ui/`), React Router v6, and Zustand. The `@/` import alias maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

### State lives in Zustand stores, not React context

All meaningful application state and data-fetching lives in `src/store/*.ts` (`authStore`, `workspaceStore`, `crmStore`, `kanbanStore`, `conversationStore`, `sectorStore`, `trackingStore`, `baselinkerStore`, `automationStore`, `aiAgentStore`). Stores call Supabase and external APIs directly; components mostly read store state and invoke store actions. When adding data flows, extend the relevant store rather than fetching inside components. Stores reach across to each other via `useOtherStore.getState()` (e.g. `authStore` clears `workspaceStore` on logout).

### Workspace = tenant boundary

`workspaceStore.currentWorkspace` is the central tenant context. Almost every query is scoped with `.eq('workspace_id', currentWorkspace.id)`, and store actions early-return when there is no current workspace. The bootstrap sequence in `src/App.tsx` is: `authStore.initialize()` (restores Supabase session) → `workspaceStore.fetchWorkspaces()` → select a workspace (from `localStorage.currentWorkspaceId` or the first one) → restore `localStorage.lastVisitedRoute`. Protected routes redirect to `/onboarding` whenever `currentWorkspace` is null. `setCurrentWorkspace` also triggers dependent fetches (channels, WhatsApp instances) as a side effect.

### Centralized error handling

`src/lib/error-handler.ts` (`ErrorHandler`) is the single path for surfacing errors. Wrap async store actions in `ErrorHandler.handleAsync(...)` — it catches, translates the error to a Portuguese message (it pattern-matches Supabase/Evolution/HTTP errors), shows a `sonner` toast, and returns `null` on failure. Use `ErrorHandler.showSuccess(...)` for success toasts. Prefer this over ad-hoc try/catch + toast.

### Two patterns for external integrations

1. **Direct from the browser** — Evolution API (WhatsApp) in `src/lib/evolution-api.ts`, accessed via the `getEvolutionAPI()` singleton. Note: its `serverUrl` and `apiKey` are **hardcoded** in that file.
2. **Through a Supabase Edge Function proxy** — used when CORS or secret-hiding matters. The browser calls a function under `${VITE_SUPABASE_URL}/functions/v1/<name>`; the function forwards to the third-party API. Examples: `baselinker-proxy` (Baselinker ERP, see `src/lib/baselinker-api.ts`), `tracking-proxy` / `tracking-automation` (carrier package tracking, see `src/lib/tracking-api.ts`), `evolution-webhook` (inbound WhatsApp events), `register-user` (privileged user creation). When adding an integration that needs a secret or hits CORS, follow the proxy pattern and add a function under `supabase/functions/`.

### Things to know

- **Incomplete features are stubbed, not removed.** Several `workspaceStore` user-management actions (`inviteUser`, `removeUser`, `fetchWorkspaceUsers`, etc.) deliberately throw "temporariamente indisponível" or return empty arrays because the `workspace_users` / `user_invitations` tables aren't in the live schema yet. Check the schema before wiring these up.
- The `Briefing/` folder holds exported **n8n workflow JSON** — reference material for automations being reimplemented inside the app (Edge Functions + the automation builder), not runtime code.
- `Schema.sql` at the repo root is a full schema snapshot; `supabase/migrations/` is the incremental source of truth.
