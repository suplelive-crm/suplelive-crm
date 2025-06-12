/*
  # CRM Dashboard Initial Schema

  1. New Tables
    - `leads`
      - `id` (uuid, primary key)
      - `name` (text)
      - `phone` (text)
      - `email` (text)
      - `source` (text)
      - `status` (text, default 'new')
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)

    - `clients`
      - `id` (uuid, primary key)
      - `name` (text)
      - `phone` (text)
      - `email` (text)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)

    - `orders`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `total_amount` (decimal)
      - `order_date` (timestamp)
      - `status` (text, default 'pending')

    - `messages`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `content` (text)
      - `send_type` (text)
      - `status` (text, default 'pending')
      - `timestamp` (timestamp)

    - `campaigns`
      - `id` (uuid, primary key)
      - `name` (text)
      - `segment` (text)
      - `message` (text)
      - `scheduled_at` (timestamp)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  source text DEFAULT '',
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  order_date timestamptz DEFAULT now(),
  status text DEFAULT 'pending'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  content text NOT NULL,
  send_type text DEFAULT 'manual',
  status text DEFAULT 'pending',
  timestamp timestamptz DEFAULT now()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for leads
CREATE POLICY "Users can manage their own leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for clients
CREATE POLICY "Users can manage their own clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for orders
CREATE POLICY "Users can manage orders for their clients"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Create policies for messages
CREATE POLICY "Users can manage messages for their clients"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Create policies for campaigns
CREATE POLICY "Users can manage their own campaigns"
  ON campaigns
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);