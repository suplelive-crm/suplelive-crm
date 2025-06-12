/*
  # Sistema Kanban para Gestão de Clientes

  1. New Tables
    - `kanban_boards` - Quadros Kanban
    - `kanban_stages` - Fases/Colunas do Kanban
    - `kanban_client_assignments` - Atribuições de clientes às fases

  2. Security
    - Enable RLS on all tables
    - Add policies for workspace isolation
*/

-- Create kanban_boards table
CREATE TABLE IF NOT EXISTS kanban_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create kanban_stages table
CREATE TABLE IF NOT EXISTS kanban_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES kanban_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create kanban_client_assignments table
CREATE TABLE IF NOT EXISTS kanban_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES kanban_boards(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES kanban_stages(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(board_id, client_id)
);

-- Enable RLS
ALTER TABLE kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_client_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for kanban_boards
CREATE POLICY "Users can manage their workspace kanban boards"
  ON kanban_boards
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

-- Create policies for kanban_stages
CREATE POLICY "Users can manage stages for their workspace boards"
  ON kanban_stages
  FOR ALL
  TO authenticated
  USING (
    board_id IN (
      SELECT id FROM kanban_boards 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id FROM kanban_boards 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create policies for kanban_client_assignments
CREATE POLICY "Users can manage client assignments for their workspace boards"
  ON kanban_client_assignments
  FOR ALL
  TO authenticated
  USING (
    board_id IN (
      SELECT id FROM kanban_boards 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id FROM kanban_boards 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kanban_boards_workspace_id ON kanban_boards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kanban_stages_board_id ON kanban_stages(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_stages_position ON kanban_stages(board_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_client_assignments_board_id ON kanban_client_assignments(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_client_assignments_stage_id ON kanban_client_assignments(stage_id);
CREATE INDEX IF NOT EXISTS idx_kanban_client_assignments_client_id ON kanban_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_kanban_client_assignments_position ON kanban_client_assignments(stage_id, position);