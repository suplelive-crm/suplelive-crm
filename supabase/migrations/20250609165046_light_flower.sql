/*
  # Add read_at column to messages table

  1. Changes
    - Add `read_at` column to messages table for tracking when messages are read
    - Column is nullable timestamptz type

  2. Security
    - No RLS changes needed as this is just adding a column to existing table
*/

-- Add read_at column to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN read_at timestamptz;
  END IF;
END $$;