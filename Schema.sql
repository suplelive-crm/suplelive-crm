-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  role text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_agents_pkey PRIMARY KEY (id),
  CONSTRAINT ai_agents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.automation_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid,
  trigger_id uuid,
  type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  position jsonb DEFAULT '{"x": 0, "y": 0}'::jsonb,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_actions_pkey PRIMARY KEY (id),
  CONSTRAINT automation_actions_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES public.automation_triggers(id),
  CONSTRAINT automation_actions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.automation_workflows(id)
);
CREATE TABLE public.automation_conditions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid,
  action_id uuid,
  type text NOT NULL,
  operator text NOT NULL,
  value text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_conditions_pkey PRIMARY KEY (id),
  CONSTRAINT automation_conditions_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.automation_actions(id),
  CONSTRAINT automation_conditions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.automation_workflows(id)
);
CREATE TABLE public.automation_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid,
  trigger_data jsonb DEFAULT '{}'::jsonb,
  execution_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'running'::text,
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  client_id uuid,
  conversation_id uuid,
  CONSTRAINT automation_executions_pkey PRIMARY KEY (id),
  CONSTRAINT automation_executions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT automation_executions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT automation_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.automation_workflows(id)
);
CREATE TABLE public.automation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_templates_pkey PRIMARY KEY (id),
  CONSTRAINT automation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.automation_triggers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid,
  type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  position jsonb DEFAULT '{"x": 0, "y": 0}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_triggers_pkey PRIMARY KEY (id),
  CONSTRAINT automation_triggers_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.automation_workflows(id)
);
CREATE TABLE public.automation_workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft'::text,
  trigger_type text NOT NULL,
  workflow_data jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  execution_count integer DEFAULT 0,
  last_executed timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ai_config jsonb DEFAULT '{}'::jsonb,
  n8n_webhook_url text,
  CONSTRAINT automation_workflows_pkey PRIMARY KEY (id),
  CONSTRAINT automation_workflows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  n8n_webhook_url text,
  status text DEFAULT 'active'::text,
  execution_count integer DEFAULT 0,
  last_executed timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automations_pkey PRIMARY KEY (id),
  CONSTRAINT automations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.baselinker_sync (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid UNIQUE,
  last_orders_sync timestamp with time zone,
  last_customers_sync timestamp with time zone,
  last_inventory_sync timestamp with time zone,
  sync_status text DEFAULT 'idle'::text,
  sync_errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT baselinker_sync_pkey PRIMARY KEY (id),
  CONSTRAINT baselinker_sync_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  workspace_id uuid,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT campaigns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  type text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'disconnected'::text,
  last_sync timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT channels_pkey PRIMARY KEY (id),
  CONSTRAINT channels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  workspace_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  cpf text,
  chatwoot_contact boolean,
  total_gasto numeric,
  total_pedidos numeric,
  ultima_att timestamp with time zone,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT clients_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  client_id uuid,
  channel_id uuid,
  channel_type text NOT NULL,
  external_id text,
  status text DEFAULT 'open'::text,
  assigned_to uuid,
  last_message_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  sector_id uuid,
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  CONSTRAINT conversations_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id),
  CONSTRAINT conversations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT conversations_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id),
  CONSTRAINT conversations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.kanban_boards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kanban_boards_pkey PRIMARY KEY (id),
  CONSTRAINT kanban_boards_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.kanban_client_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid,
  stage_id uuid,
  client_id uuid,
  position integer NOT NULL DEFAULT 0,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kanban_client_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT kanban_client_assignments_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id),
  CONSTRAINT kanban_client_assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT kanban_client_assignments_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.kanban_stages(id)
);
CREATE TABLE public.kanban_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid,
  name text NOT NULL,
  color text DEFAULT '#3b82f6'::text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kanban_stages_pkey PRIMARY KEY (id),
  CONSTRAINT kanban_stages_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id)
);
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  source text DEFAULT ''::text,
  status text DEFAULT 'new'::text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  workspace_id uuid,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT leads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.log_lançamento_estoque (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  dia_lancado timestamp with time zone NOT NULL DEFAULT now(),
  sku text,
  quantidade numeric,
  pruchase_id uuid DEFAULT gen_random_uuid(),
  tracking_code text,
  CONSTRAINT log_lançamento_estoque_pkey PRIMARY KEY (id)
);
CREATE TABLE public.log_lançamento_transferencia (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  dia_lancado timestamp with time zone NOT NULL DEFAULT now(),
  sku text,
  quantidade numeric,
  tracking_code text,
  tipo text,
  estoque_origem text,
  estoque_destino text,
  CONSTRAINT log_lançamento_transferencia_pkey PRIMARY KEY (id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  content text NOT NULL,
  send_type text DEFAULT 'manual'::text,
  status text DEFAULT 'pending'::text,
  timestamp timestamp with time zone DEFAULT now(),
  conversation_id uuid,
  channel_type text DEFAULT 'whatsapp'::text,
  sender_type text DEFAULT 'user'::text,
  external_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  total_amount numeric NOT NULL DEFAULT 0,
  order_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  external_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  order_id_base numeric,
  mensagem_enviada boolean DEFAULT false,
  atualizado_chatwoot timestamp with time zone,
  canal_venda text,
  taxas real,
  id_anuncio text,
  conta text,
  id_pedido_marktplace text,
  faturamento_liquido real,
  custo_frete(taxa) real,
  produtos_order boolean DEFAULT false,
  metadata_feita boolean NOT NULL DEFAULT false,
  cpf text,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.orders_products (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  order_id uuid DEFAULT gen_random_uuid(),
  nome_produto text,
  sku text,
  custo_medio_produto real,
  order_base_id numeric,
  quantidade_produtos numeric,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faturamento_liquido numeric,
  receita_bruta numeric,
  taxas_produto numeric,
  envio_duracao date,
  mensagem_recompra boolean DEFAULT false,
  CONSTRAINT orders_products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  sku text,
  ean text,
  price numeric NOT NULL DEFAULT 0,
  stock_es integer NOT NULL DEFAULT 0,
  description text,
  images jsonb DEFAULT '[]'::jsonb,
  external_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  embedding USER-DEFINED,
  custo real,
  preco_atacado numeric,
  duracao numeric,
  stock_sp integer DEFAULT 0,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.products_kit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  sku text,
  ean text,
  price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  description text,
  images jsonb DEFAULT '[]'::jsonb,
  external_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  custo_produto numeric,
  metadata jsonb,
  sku_produto text,
  quantidade_produto smallint,
  CONSTRAINT products_kit_pkey PRIMARY KEY (id),
  CONSTRAINT products_kit_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.purchase_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_id uuid,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  cost numeric NOT NULL DEFAULT 0,
  total_cost numeric DEFAULT (cost * (quantity)::numeric),
  is_verified boolean DEFAULT false,
  is_in_stock boolean,
  updated_at timestamp without time zone,
  vencimento timestamp without time zone,
  SKU text,
  mensagem_enviada_dia boolean DEFAULT false,
  preco_ml double precision,
  preco_atacado numeric,
  CONSTRAINT purchase_products_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_products_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id)
);
CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  date date NOT NULL,
  carrier text NOT NULL,
  storeName text NOT NULL,
  customer_name text,
  trackingCode text NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'Aguardando rastreamento'::text,
  estimated_delivery date,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  atualizado timestamp with time zone,
  metadata jsonb,
  observation text,
  CONSTRAINT purchases_pkey PRIMARY KEY (id),
  CONSTRAINT purchases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  date date NOT NULL,
  carrier text NOT NULL,
  storeName text NOT NULL,
  customer_name text NOT NULL,
  trackingCode text NOT NULL,
  status text DEFAULT 'Aguardando rastreamento'::text,
  estimated_delivery date,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  observations text,
  is_verified boolean DEFAULT false,
  verification_observations text,
  verified_at timestamp with time zone,
  atualizado timestamp with time zone,
  metadata jsonb,
  CONSTRAINT returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6'::text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sectors_pkey PRIMARY KEY (id),
  CONSTRAINT sectors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  plan_id uuid,
  status text DEFAULT 'active'::text,
  billing_info jsonb DEFAULT '{}'::jsonb,
  current_period_start timestamp with time zone DEFAULT now(),
  current_period_end timestamp with time zone DEFAULT (now() + '1 mon'::interval),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.transfer_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  sku text,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_in_stock boolean DEFAULT false,
  retirado_estoque_origem boolean DEFAULT false,
  CONSTRAINT transfer_products_pkey PRIMARY KEY (id),
  CONSTRAINT transfer_products_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.transfers(id)
);
CREATE TABLE public.transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  date date NOT NULL,
  carrier text NOT NULL,
  storeName text NOT NULL,
  customer_name text NOT NULL,
  trackingCode text NOT NULL,
  status text DEFAULT 'Aguardando rastreamento'::text,
  estimated_delivery date,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  atualizado timestamp with time zone,
  metadata jsonb,
  source_stock text,
  destination_stock text,
  conferido boolean,
  in_stock boolean,
  retirado_stock boolean,
  CONSTRAINT transfers_pkey PRIMARY KEY (id),
  CONSTRAINT transfers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.whatsapp_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  instance_name text NOT NULL,
  session_id text UNIQUE,
  qr_code text,
  status text DEFAULT 'disconnected'::text,
  phone_number text,
  webhook_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_instances_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_instances_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan_id uuid,
  owner_id uuid,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspaces_pkey PRIMARY KEY (id),
  CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id),
  CONSTRAINT workspaces_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id)
);