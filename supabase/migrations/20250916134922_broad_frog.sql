/*
  # Add stock columns to transfers table

  1. Changes
    - Add `source_stock` column to store the origin stock location
    - Add `destination_stock` column to store the destination stock location
  
  2. Notes
    - Both columns are text type to store location names like 'Vitoria' or 'São Paulo'
    - Columns are nullable to maintain compatibility with existing data
*/

-- Add source_stock column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'source_stock'
  ) THEN
    ALTER TABLE transfers ADD COLUMN source_stock text;
  END IF;
END $$;

-- Add destination_stock column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'destination_stock'
  ) THEN
    ALTER TABLE transfers ADD COLUMN destination_stock text;
  END IF;
END $$;