-- Add mcp_api_key column to user_preferences for MCP server authentication
-- Each user can have one API key stored here; scoped to their user_id via RLS.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS mcp_api_key TEXT DEFAULT NULL;

-- Index for fast key lookup in the MCP edge function
CREATE INDEX IF NOT EXISTS idx_user_preferences_mcp_api_key
  ON user_preferences (mcp_api_key)
  WHERE mcp_api_key IS NOT NULL;
