/*
  # Create transfer_products table

  1. New Tables
    - `transfer_products`
      - `id` (uuid, primary key)
      - `transfer_id` (uuid, foreign key to transfers)
      - `name` (text, product name)
      - `quantity` (integer, quantity)
      - `sku` (text, product SKU)
      - `is_verified` (boolean, verification status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `transfer_products` table
    - Add policy for users to manage products for their workspace transfers

  3. Foreign Key
    - `transfer_id` references `transfers(id)` with CASCADE delete
*/

CREATE TABLE IF NOT EXISTS transfer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  sku text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT transfer_products_transfer_id_fkey 
    FOREIGN KEY (transfer_id) 
    REFERENCES transfers(id) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE transfer_products ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage products for their workspace transfers
CREATE POLICY "Users can manage products for their workspace transfers"
  ON transfer_products
  FOR ALL
  TO authenticated
  USING (
    transfer_id IN (
      SELECT transfers.id 
      FROM transfers 
      WHERE transfers.workspace_id IN (
        SELECT workspaces.id 
        FROM workspaces 
        WHERE workspaces.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    transfer_id IN (
      SELECT transfers.id 
      FROM transfers 
      WHERE transfers.workspace_id IN (
        SELECT workspaces.id 
        FROM workspaces 
        WHERE workspaces.owner_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transfer_products_transfer_id 
  ON transfer_products(transfer_id);