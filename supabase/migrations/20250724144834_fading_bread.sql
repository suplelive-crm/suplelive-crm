/*
  # Adicionar campos de observações e conferência para devoluções

  1. Modificações na tabela `returns`
    - `observations` (text) - Observações gerais da devolução
    - `is_verified` (boolean) - Se a devolução foi conferida
    - `verification_observations` (text) - Observações da conferência
    - `verified_at` (timestamp) - Data/hora da conferência

  2. Segurança
    - Manter RLS existente na tabela `returns`
*/

-- Adicionar novos campos à tabela returns
DO $$
BEGIN
  -- Adicionar campo observations se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'observations'
  ) THEN
    ALTER TABLE returns ADD COLUMN observations text;
  END IF;

  -- Adicionar campo is_verified se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE returns ADD COLUMN is_verified boolean DEFAULT false;
  END IF;

  -- Adicionar campo verification_observations se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'verification_observations'
  ) THEN
    ALTER TABLE returns ADD COLUMN verification_observations text;
  END IF;

  -- Adicionar campo verified_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE returns ADD COLUMN verified_at timestamptz;
  END IF;
END $$;