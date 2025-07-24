/*
  # Adicionar coluna 'atualizado' para tracking automation

  1. Alterações nas Tabelas
    - Adiciona coluna `atualizado` na tabela `purchases`
    - Adiciona coluna `atualizado` na tabela `returns` 
    - Adiciona coluna `atualizado` na tabela `transfers`
    
  2. Funcionalidade
    - Permite controlar quando foi a última atualização de rastreamento
    - Usado pela automação para determinar quais itens precisam ser atualizados
    - Evita atualizações desnecessárias (só atualiza se passou mais de 6 horas)
*/

-- Adicionar coluna atualizado na tabela purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'atualizado'
  ) THEN
    ALTER TABLE purchases ADD COLUMN atualizado timestamptz;
  END IF;
END $$;

-- Adicionar coluna atualizado na tabela returns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'atualizado'
  ) THEN
    ALTER TABLE returns ADD COLUMN atualizado timestamptz;
  END IF;
END $$;

-- Adicionar coluna atualizado na tabela transfers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfers' AND column_name = 'atualizado'
  ) THEN
    ALTER TABLE transfers ADD COLUMN atualizado timestamptz;
  END IF;
END $$;