/*
  # Add customerName column to purchases table

  1. Changes
    - Add `customer_name` column to `purchases` table
    - Column is nullable since it's optional in the application
    - Column type is TEXT to store customer names

  2. Notes
    - This resolves the database schema mismatch where the application
      expects a customerName field but the database table doesn't have it
    - The column is added as nullable since customer name is optional
      in the purchase creation form
*/

-- Add customer_name column to purchases table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE purchases ADD COLUMN customer_name TEXT;
  END IF;
END $$;