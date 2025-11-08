// Shared workspace configuration loader for Edge Functions
// Fetches API keys and credentials from workspace settings in database

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface WorkspaceConfig {
  workspace_id: string;
  workspace_name: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  baselinker?: BaselinkerSettings;
  evolution?: EvolutionSettings;
  openai?: OpenAISettings;
  n8n?: N8nSettings;
}

export interface BaselinkerSettings {
  token: string;
  warehouse_es?: number;
  warehouse_sp?: number;
  enabled: boolean;
}

export interface EvolutionSettings {
  api_url: string;
  api_key: string;
  enabled: boolean;
}

export interface OpenAISettings {
  api_key: string;
  model?: string;
  enabled: boolean;
}

export interface N8nSettings {
  webhook_url: string;
  enabled: boolean;
}

/**
 * Get workspace configuration by workspace ID
 */
export async function getWorkspaceConfig(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<WorkspaceConfig> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, settings')
    .eq('id', workspaceId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch workspace config: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  return {
    workspace_id: data.id,
    workspace_name: data.name,
    settings: data.settings || {},
  };
}

/**
 * Get all workspaces with a specific integration enabled
 */
export async function getWorkspacesWithIntegration(
  supabase: SupabaseClient,
  integration: 'baselinker' | 'evolution' | 'openai' | 'n8n'
): Promise<WorkspaceConfig[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, settings');

  if (error) {
    throw new Error(`Failed to fetch workspaces: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  // Filter workspaces that have the integration enabled
  return data
    .filter((workspace) => {
      const settings = workspace.settings as WorkspaceSettings;
      return settings?.[integration]?.enabled === true;
    })
    .map((workspace) => ({
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      settings: workspace.settings || {},
    }));
}

/**
 * Get Baselinker token for a workspace
 */
export async function getBaselinkerToken(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const config = await getWorkspaceConfig(supabase, workspaceId);

  if (!config.settings.baselinker?.enabled) {
    throw new Error(`Baselinker not enabled for workspace ${workspaceId}`);
  }

  if (!config.settings.baselinker?.token) {
    throw new Error(`Baselinker token not configured for workspace ${workspaceId}`);
  }

  return config.settings.baselinker.token;
}

/**
 * Get Evolution API credentials for a workspace
 */
export async function getEvolutionConfig(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<EvolutionSettings> {
  const config = await getWorkspaceConfig(supabase, workspaceId);

  if (!config.settings.evolution?.enabled) {
    throw new Error(`Evolution API not enabled for workspace ${workspaceId}`);
  }

  if (!config.settings.evolution?.api_url || !config.settings.evolution?.api_key) {
    throw new Error(`Evolution API not configured for workspace ${workspaceId}`);
  }

  return config.settings.evolution;
}

/**
 * Get OpenAI API key for a workspace
 */
export async function getOpenAIConfig(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<OpenAISettings> {
  const config = await getWorkspaceConfig(supabase, workspaceId);

  if (!config.settings.openai?.enabled) {
    throw new Error(`OpenAI not enabled for workspace ${workspaceId}`);
  }

  if (!config.settings.openai?.api_key) {
    throw new Error(`OpenAI API key not configured for workspace ${workspaceId}`);
  }

  return config.settings.openai;
}

/**
 * Get n8n webhook URL for a workspace
 */
export async function getN8nConfig(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<N8nSettings> {
  const config = await getWorkspaceConfig(supabase, workspaceId);

  if (!config.settings.n8n?.enabled) {
    throw new Error(`n8n not enabled for workspace ${workspaceId}`);
  }

  if (!config.settings.n8n?.webhook_url) {
    throw new Error(`n8n webhook URL not configured for workspace ${workspaceId}`);
  }

  return config.settings.n8n;
}

/**
 * Update workspace settings (partial update)
 */
export async function updateWorkspaceSettings(
  supabase: SupabaseClient,
  workspaceId: string,
  settingsUpdate: Partial<WorkspaceSettings>
): Promise<void> {
  // Get current settings
  const currentConfig = await getWorkspaceConfig(supabase, workspaceId);

  // Merge with new settings
  const updatedSettings = {
    ...currentConfig.settings,
    ...settingsUpdate,
  };

  const { error } = await supabase
    .from('workspaces')
    .update({ settings: updatedSettings })
    .eq('id', workspaceId);

  if (error) {
    throw new Error(`Failed to update workspace settings: ${error.message}`);
  }
}

/**
 * Get workspace ID from Baselinker sync state (for event processing)
 */
export async function getWorkspaceIdFromBaselinkerEvent(
  supabase: SupabaseClient,
  orderId?: number
): Promise<string> {
  // For now, we get the first workspace with Baselinker enabled
  // In the future, you can add logic to map Baselinker orders to specific workspaces
  // For example, by storing baselinker_account_id in workspace settings

  const workspaces = await getWorkspacesWithIntegration(supabase, 'baselinker');

  if (workspaces.length === 0) {
    throw new Error('No workspaces with Baselinker integration found');
  }

  // TODO: Add logic to map order to specific workspace if multiple workspaces exist
  // Could check baselinker_sync_state table or order metadata

  return workspaces[0].workspace_id;
}
