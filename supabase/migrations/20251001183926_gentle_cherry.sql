/*
  # Add transfer status and archive columns

  1. New Columns
    - `conferido` (boolean) - Indicates if transfer has been verified
    - `in_stock` (boolean) - Indicates if transfer has been added to stock
    - `retirado_stock` (boolean) - Indicates if items were removed from source stock
    - `is_archived` (boolean) - Indicates if transfer is archived

  2. Updates
    - Add default values for new columns
    - Update existing transfers to have default values

  3. Security
    - No RLS changes needed as transfers table already has proper policies
*/

-- Add new columns to transfers table
DO $$
BEGIN
  -- Add conferido column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'conferido'
  ) THEN
    ALTER TABLE transfers ADD COLUMN conferido boolean DEFAULT false;
  END IF;

  -- Add in_stock column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'in_stock'
  ) THEN
    ALTER TABLE transfers ADD COLUMN in_stock boolean DEFAULT false;
  END IF;

  -- Add retirado_stock column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'retirado_stock'
  ) THEN
    ALTER TABLE transfers ADD COLUMN retirado_stock boolean DEFAULT false;
  END IF;

  -- Add is_archived column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE transfers ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
END $$;

-- Update existing transfers to have default values
UPDATE transfers 
SET 
  conferido = COALESCE(conferido, false),
  in_stock = COALESCE(in_stock, false),
  retirado_stock = COALESCE(retirado_stock, false),
  is_archived = COALESCE(is_archived, false)
WHERE 
  conferido IS NULL 
  OR in_stock IS NULL 
  OR retirado_stock IS NULL 
  OR is_archived IS NULL;