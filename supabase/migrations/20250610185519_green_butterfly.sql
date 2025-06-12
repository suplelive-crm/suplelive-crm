/*
  # Tracking Module Schema

  1. New Tables
    - `purchases` - Purchase tracking
    - `purchase_products` - Products in purchases
    - `returns` - Return tracking
    - `transfers` - Transfer tracking
    
  2. Features
    - Track purchases, returns, and transfers
    - Track products within purchases
    - Track shipping status
    
  3. Security
    - Enable RLS on all tables
    - Workspace-based access control
*/

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  carrier text NOT NULL,
  store_name text NOT NULL,
  customer_name text,
  trackingCode text NOT NULL,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  status text DEFAULT 'Aguardando rastreamento',
  estimated_delivery date,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchase_products table
CREATE TABLE IF NOT EXISTS purchase_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2) GENERATED ALWAYS AS (cost * quantity) STORED,
  is_verified boolean DEFAULT false
);

-- Create returns table
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  carrier text NOT NULL,
  store_name text NOT NULL,
  customer_name text NOT NULL,
  trackingCode text NOT NULL,
  status text DEFAULT 'Aguardando rastreamento',
  estimated_delivery date,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transfers table
CREATE TABLE IF NOT EXISTS transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  carrier text NOT NULL,
  storeName text NOT NULL,
  customer_name text NOT NULL,
  trackingCode text NOT NULL,
  status text DEFAULT 'Aguardando rastreamento',
  estimated_delivery date,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Create policies for purchases
CREATE POLICY "Users can manage their workspace purchases"
  ON purchases
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

-- Create policies for purchase_products
CREATE POLICY "Users can manage products for their workspace purchases"
  ON purchase_products
  FOR ALL
  TO authenticated
  USING (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create policies for returns
CREATE POLICY "Users can manage their workspace returns"
  ON returns
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

-- Create policies for transfers
CREATE POLICY "Users can manage their workspace transfers"
  ON transfers
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
CREATE INDEX IF NOT EXISTS idx_purchases_workspace_id ON purchases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tracking_code ON purchases(tracking_code);
CREATE INDEX IF NOT EXISTS idx_purchase_products_purchase_id ON purchase_products(purchase_id);
CREATE INDEX IF NOT EXISTS idx_returns_workspace_id ON returns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_returns_tracking_code ON returns(tracking_code);
CREATE INDEX IF NOT EXISTS idx_transfers_workspace_id ON transfers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transfers_tracking_code ON transfers(tracking_code);