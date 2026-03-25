import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, slug } = await req.json();

    // -------------------------------------------------------------
    // STUB: This represents the vault integration layer (Server-side)
    // In production, this might:
    // a) Call an MCP server proxy.
    // b) Read from a git-synced bucket.
    // c) Call a locally running Desktop agent over tailscale/ngrok.
    // -------------------------------------------------------------
    
    // Proxy to local Python Bridge running on host
    const BRIDGE_URL = "http://host.docker.internal:8090";

    if (action === 'list_workspaces') {
      const response = await fetch(`${BRIDGE_URL}/api/workspaces`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'list_files') {
      const response = await fetch(`${BRIDGE_URL}/api/workspaces/${slug}/files`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
