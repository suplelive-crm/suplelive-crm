/*
  # Sistema de Gerenciamento de Usuários com Roles

  1. New Tables
    - `workspace_users`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `role` (text, 'admin' or 'operator')
      - `invited_by` (uuid, foreign key)
      - `invited_at` (timestamp)
      - `joined_at` (timestamp)
      - `status` (text, 'pending', 'active', 'inactive')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `user_invitations`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, foreign key)
      - `email` (text)
      - `role` (text, 'admin' or 'operator')
      - `invited_by` (uuid, foreign key)
      - `token` (text, unique)
      - `expires_at` (timestamp)
      - `accepted_at` (timestamp)
      - `status` (text, 'pending', 'accepted', 'expired')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for workspace owners and members
    - Add unique constraints to prevent duplicates

  3. Functions
    - Function to check workspace name/slug uniqueness
    - Function to invite users
    - Function to accept invitations
*/

-- Create workspace_users table
CREATE TABLE IF NOT EXISTS workspace_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_role ON workspace_users(role);
CREATE INDEX IF NOT EXISTS idx_user_invitations_workspace_id ON user_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);

-- Enable RLS
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace_users
CREATE POLICY "Users can view workspace members they belong to"
  ON workspace_users
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id 
      FROM workspaces 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage members"
  ON workspace_users
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id 
      FROM workspaces 
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id 
      FROM workspaces 
      WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for user_invitations
CREATE POLICY "Users can view invitations for their workspaces"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id 
      FROM workspaces 
      WHERE owner_id = auth.uid()
    )
    OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Workspace admins can manage invitations"
  ON user_invitations
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id 
      FROM workspaces 
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
    OR
    workspace_id IN (
      SELECT id 
      FROM workspaces 
      WHERE owner_id = auth.uid()
    )
  );

-- Function to check workspace uniqueness
CREATE OR REPLACE FUNCTION check_workspace_uniqueness(
  workspace_name text,
  workspace_slug text,
  exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(name_exists boolean, slug_exists boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(
      SELECT 1 FROM workspaces 
      WHERE LOWER(name) = LOWER(workspace_name) 
      AND (exclude_id IS NULL OR id != exclude_id)
    ) as name_exists,
    EXISTS(
      SELECT 1 FROM workspaces 
      WHERE slug = workspace_slug 
      AND (exclude_id IS NULL OR id != exclude_id)
    ) as slug_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invite user to workspace
CREATE OR REPLACE FUNCTION invite_user_to_workspace(
  p_workspace_id uuid,
  p_email text,
  p_role text,
  p_invited_by uuid
)
RETURNS uuid AS $$
DECLARE
  invitation_id uuid;
  existing_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO existing_user_id 
  FROM auth.users 
  WHERE email = p_email;
  
  -- Check if user is already in workspace
  IF existing_user_id IS NOT NULL THEN
    IF EXISTS(
      SELECT 1 FROM workspace_users 
      WHERE workspace_id = p_workspace_id 
      AND user_id = existing_user_id 
      AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'User is already a member of this workspace';
    END IF;
  END IF;
  
  -- Cancel any existing pending invitations for this email/workspace
  UPDATE user_invitations 
  SET status = 'expired' 
  WHERE workspace_id = p_workspace_id 
  AND email = p_email 
  AND status = 'pending';
  
  -- Create new invitation
  INSERT INTO user_invitations (
    workspace_id, 
    email, 
    role, 
    invited_by
  ) VALUES (
    p_workspace_id, 
    p_email, 
    p_role, 
    p_invited_by
  ) RETURNING id INTO invitation_id;
  
  -- If user already exists, add them directly to workspace
  IF existing_user_id IS NOT NULL THEN
    INSERT INTO workspace_users (
      workspace_id,
      user_id,
      role,
      invited_by,
      joined_at,
      status
    ) VALUES (
      p_workspace_id,
      existing_user_id,
      p_role,
      p_invited_by,
      now(),
      'active'
    );
    
    -- Mark invitation as accepted
    UPDATE user_invitations 
    SET status = 'accepted', accepted_at = now() 
    WHERE id = invitation_id;
  END IF;
  
  RETURN invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_workspace_invitation(
  p_token text,
  p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
  invitation_record record;
  workspace_user_id uuid;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM user_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;
  
  -- Check if user email matches invitation
  IF NOT EXISTS(
    SELECT 1 FROM auth.users 
    WHERE id = p_user_id 
    AND email = invitation_record.email
  ) THEN
    RAISE EXCEPTION 'User email does not match invitation';
  END IF;
  
  -- Add user to workspace
  INSERT INTO workspace_users (
    workspace_id,
    user_id,
    role,
    invited_by,
    joined_at,
    status
  ) VALUES (
    invitation_record.workspace_id,
    p_user_id,
    invitation_record.role,
    invitation_record.invited_by,
    now(),
    'active'
  ) RETURNING id INTO workspace_user_id;
  
  -- Mark invitation as accepted
  UPDATE user_invitations 
  SET status = 'accepted', accepted_at = now() 
  WHERE id = invitation_record.id;
  
  RETURN workspace_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role in workspace
CREATE OR REPLACE FUNCTION get_user_workspace_role(
  p_workspace_id uuid,
  p_user_id uuid
)
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  -- Check if user is workspace owner
  IF EXISTS(
    SELECT 1 FROM workspaces 
    WHERE id = p_workspace_id 
    AND owner_id = p_user_id
  ) THEN
    RETURN 'owner';
  END IF;
  
  -- Get user role from workspace_users
  SELECT role INTO user_role
  FROM workspace_users
  WHERE workspace_id = p_workspace_id
  AND user_id = p_user_id
  AND status = 'active';
  
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Populate workspace_users for existing workspace owners
INSERT INTO workspace_users (workspace_id, user_id, role, joined_at, status)
SELECT id, owner_id, 'admin', created_at, 'active'
FROM workspaces
WHERE owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;