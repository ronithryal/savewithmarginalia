import { supabase } from "@/integrations/supabase/client";

export type DexFileMeta = {
  id: string;
  title: string;
  type: 'next_bet' | 'spec' | 'intel' | 'decision' | 'doc' | 'learning';
  status?: 'proposed' | 'accepted' | 'rejected' | 'draft' | 'final';
  tags?: string[];
  workspace_slug: string;
  created_at: string;
  url?: string;
};

export type DexWorkspace = {
  slug: string;
  name: string;
  description: string;
};

const DEX_API_URL = "http://localhost:8090/api";

export const dexVaultApi = {
  /**
   * List all available workspaces (reads 10-workspaces/)
   */
  async getWorkspaces(): Promise<DexWorkspace[]> {
    const res = await fetch(`${DEX_API_URL}/workspaces`);
    if (!res.ok) throw new Error("Failed to fetch workspaces from Dex Engine");
    const data = await res.json();
    return data.workspaces;
  },

  /**
   * Get all markdown files for a specific workspace
   */
  async getWorkspaceFiles(slug: string): Promise<DexFileMeta[]> {
    const res = await fetch(`${DEX_API_URL}/workspaces/${slug}/files`);
    if (!res.ok) throw new Error("Failed to fetch files from Dex Engine");
    const data = await res.json();
    return data.files;
  },

  /**
   * Run a Dex/Claude skill
   */
  async triggerSkill(skill: string, workspaceSlug: string, betId?: string): Promise<{ success: boolean, message: string }> {
    const payload: any = { skill, workspace: workspaceSlug };
    if (betId) payload.bet_id = betId;

    const res = await fetch(`${DEX_API_URL}/skills/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error("Failed to trigger Dex skill");
    const data = await res.json();
    return data;
  }
};
