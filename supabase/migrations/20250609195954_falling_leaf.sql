/*
  # Baselinker Integration Schema

  1. New Tables
    - `products` - Products from Baselinker
    - `baselinker_sync` - Sync status and timestamps
    
  2. Schema Updates
    - Add external_id and metadata to orders table
    - Add metadata to clients table
    
  3. Security
    - Enable RLS on all new tables
    - Update policies for workspace isolation
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  ean text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  description text,
  images jsonb DEFAULT '[]',
  external_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create baselinker_sync table
CREATE TABLE IF NOT EXISTS baselinker_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  last_orders_sync timestamptz,
  last_customers_sync timestamptz,
  last_inventory_sync timestamptz,
  sync_status text DEFAULT 'idle',
  sync_errors jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add external_id and metadata to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN external_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE orders ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add metadata to clients table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE clients ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE baselinker_sync ENABLE ROW LEVEL SECURITY;

-- Create policies for products
CREATE POLICY "Users can manage their workspace products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create policies for baselinker_sync
CREATE POLICY "Users can manage their workspace baselinker sync"
  ON baselinker_sync
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_workspace_id ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders(external_id);