/*
  # Create transfer_products table

  1. New Tables
    - `transfer_products`
      - `id` (uuid, primary key)
      - `transfer_id` (uuid, foreign key to transfers)
      - `name` (text, product name)
      - `quantity` (integer, quantity being transferred)
      - `sku` (text, product SKU)
      - `is_verified` (boolean, whether product was verified)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Table Updates
    - Add `source_stock` and `destination_stock` columns to `transfers` table

  3. Security
    - Enable RLS on `transfer_products` table
    - Add policy for users to manage transfer products for their workspace transfers
*/

-- Add new columns to transfers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'source_stock'
  ) THEN
    ALTER TABLE transfers ADD COLUMN source_stock text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'destination_stock'
  ) THEN
    ALTER TABLE transfers ADD COLUMN destination_stock text;
  END IF;
END $$;

-- Create transfer_products table
CREATE TABLE IF NOT EXISTS transfer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid REFERENCES transfers(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  sku text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE transfer_products ENABLE ROW LEVEL SECURITY;

-- Create policy for transfer products
CREATE POLICY "Users can manage transfer products for their workspace transfers"
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
        WHERE workspaces.owner_id = uid()
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
        WHERE workspaces.owner_id = uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transfer_products_transfer_id ON transfer_products(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_products_sku ON transfer_products(sku);