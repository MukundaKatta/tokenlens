-- TokenLens Initial Schema
-- Run with: supabase db push

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace members
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Provider connections
CREATE TABLE provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'openai', 'anthropic', 'aws_bedrock', 'google_vertex', 'azure_openai', 'custom'
  )),
  credentials_encrypted TEXT,
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Usage records (partitioned by month for performance)
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  total_cost_cents BIGINT DEFAULT 0,
  feature_tag TEXT,
  user_tag TEXT,
  team_tag TEXT,
  environment TEXT DEFAULT 'production',
  latency_ms INTEGER,
  request_id TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Budget alerts
CREATE TABLE budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  threshold_cents BIGINT NOT NULL,
  period TEXT DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly')),
  scope JSONB,
  notify_channels TEXT[],
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optimization rules
CREATE TABLE optimization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition JSONB NOT NULL,
  route_to_model TEXT NOT NULL,
  estimated_savings_pct NUMERIC,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Anomaly events log
CREATE TABLE anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT now(),
  metric TEXT NOT NULL,
  expected_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ
);

-- API keys for SDK ingestion
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly report snapshots
CREATE TABLE report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_usage_workspace_time ON usage_records(workspace_id, recorded_at DESC);
CREATE INDEX idx_usage_tags ON usage_records(workspace_id, feature_tag, team_tag);
CREATE INDEX idx_usage_provider_model ON usage_records(workspace_id, provider, model);
CREATE INDEX idx_usage_environment ON usage_records(workspace_id, environment);
CREATE INDEX idx_anomaly_workspace ON anomaly_events(workspace_id, detected_at DESC);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_provider_connections_workspace ON provider_connections(workspace_id);

-- Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view provider connections in their workspaces"
  ON provider_connections FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage provider connections"
  ON provider_connections FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can view usage records in their workspaces"
  ON usage_records FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert usage records"
  ON usage_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view budget alerts in their workspaces"
  ON budget_alerts FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage budget alerts"
  ON budget_alerts FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can view optimization rules"
  ON optimization_rules FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage optimization rules"
  ON optimization_rules FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can view anomaly events"
  ON anomaly_events FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view API keys"
  ON api_keys FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage API keys"
  ON api_keys FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can view reports"
  ON report_snapshots FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Functions for aggregation
CREATE OR REPLACE FUNCTION get_daily_costs(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE(
  day DATE,
  total_cost_cents BIGINT,
  request_count BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(recorded_at) AS day,
    SUM(ur.total_cost_cents)::BIGINT AS total_cost_cents,
    COUNT(*)::BIGINT AS request_count,
    SUM(ur.input_tokens)::BIGINT AS total_input_tokens,
    SUM(ur.output_tokens)::BIGINT AS total_output_tokens
  FROM usage_records ur
  WHERE ur.workspace_id = p_workspace_id
    AND ur.recorded_at >= p_start_date
    AND ur.recorded_at < p_end_date
  GROUP BY DATE(recorded_at)
  ORDER BY day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_cost_by_model(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE(
  provider TEXT,
  model TEXT,
  total_cost_cents BIGINT,
  request_count BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ur.provider,
    ur.model,
    SUM(ur.total_cost_cents)::BIGINT,
    COUNT(*)::BIGINT,
    SUM(ur.input_tokens)::BIGINT,
    SUM(ur.output_tokens)::BIGINT
  FROM usage_records ur
  WHERE ur.workspace_id = p_workspace_id
    AND ur.recorded_at >= p_start_date
    AND ur.recorded_at < p_end_date
  GROUP BY ur.provider, ur.model
  ORDER BY SUM(ur.total_cost_cents) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_cost_by_tag(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_tag_type TEXT
) RETURNS TABLE(
  tag_value TEXT,
  total_cost_cents BIGINT,
  request_count BIGINT
) AS $$
BEGIN
  IF p_tag_type = 'feature' THEN
    RETURN QUERY
    SELECT ur.feature_tag, SUM(ur.total_cost_cents)::BIGINT, COUNT(*)::BIGINT
    FROM usage_records ur
    WHERE ur.workspace_id = p_workspace_id
      AND ur.recorded_at >= p_start_date AND ur.recorded_at < p_end_date
      AND ur.feature_tag IS NOT NULL
    GROUP BY ur.feature_tag ORDER BY SUM(ur.total_cost_cents) DESC;
  ELSIF p_tag_type = 'team' THEN
    RETURN QUERY
    SELECT ur.team_tag, SUM(ur.total_cost_cents)::BIGINT, COUNT(*)::BIGINT
    FROM usage_records ur
    WHERE ur.workspace_id = p_workspace_id
      AND ur.recorded_at >= p_start_date AND ur.recorded_at < p_end_date
      AND ur.team_tag IS NOT NULL
    GROUP BY ur.team_tag ORDER BY SUM(ur.total_cost_cents) DESC;
  ELSIF p_tag_type = 'user' THEN
    RETURN QUERY
    SELECT ur.user_tag, SUM(ur.total_cost_cents)::BIGINT, COUNT(*)::BIGINT
    FROM usage_records ur
    WHERE ur.workspace_id = p_workspace_id
      AND ur.recorded_at >= p_start_date AND ur.recorded_at < p_end_date
      AND ur.user_tag IS NOT NULL
    GROUP BY ur.user_tag ORDER BY SUM(ur.total_cost_cents) DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER provider_connections_updated_at BEFORE UPDATE ON provider_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER budget_alerts_updated_at BEFORE UPDATE ON budget_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER optimization_rules_updated_at BEFORE UPDATE ON optimization_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
