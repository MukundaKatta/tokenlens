export type Provider =
  | "openai"
  | "anthropic"
  | "aws_bedrock"
  | "google_vertex"
  | "azure_openai"
  | "custom";

export type Plan = "free" | "pro" | "enterprise";

export type AlertPeriod = "daily" | "weekly" | "monthly";

export type Environment = "production" | "staging" | "development" | "test";

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  stripe_customer_id: string | null;
  plan: Plan;
  created_at: string;
}

export interface ProviderConnection {
  id: string;
  workspace_id: string;
  provider: Provider;
  credentials_encrypted: string | null;
  last_synced_at: string | null;
  status: "active" | "inactive" | "error";
  created_at: string;
}

export interface UsageRecord {
  id: string;
  workspace_id: string;
  provider: Provider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_cents: number;
  feature_tag: string | null;
  user_tag: string | null;
  team_tag: string | null;
  environment: Environment;
  latency_ms: number | null;
  request_id: string | null;
  recorded_at: string;
}

export interface BudgetAlert {
  id: string;
  workspace_id: string;
  name: string;
  threshold_cents: number;
  period: AlertPeriod;
  scope: AlertScope | null;
  notify_channels: string[];
  triggered_at: string | null;
  created_at: string;
}

export interface AlertScope {
  provider?: Provider;
  model?: string;
  feature_tag?: string;
  team_tag?: string;
  environment?: Environment;
}

export interface OptimizationRule {
  id: string;
  workspace_id: string;
  name: string;
  condition: OptimizationCondition;
  route_to_model: string;
  estimated_savings_pct: number | null;
  active: boolean;
  created_at: string;
}

export interface OptimizationCondition {
  source_model: string;
  max_input_tokens?: number;
  feature_tags?: string[];
  environments?: Environment[];
  min_latency_ms?: number;
}

export interface CostBreakdown {
  provider: Provider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_cents: number;
  request_count: number;
}

export interface CostTrend {
  date: string;
  total_cost_cents: number;
  request_count: number;
}

export interface CostForecast {
  date: string;
  projected_cost_cents: number;
  lower_bound_cents: number;
  upper_bound_cents: number;
}

export interface AnomalyEvent {
  id: string;
  workspace_id: string;
  detected_at: string;
  metric: string;
  expected_value: number;
  actual_value: number;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface IngestPayload {
  provider: Provider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  feature_tag?: string;
  user_tag?: string;
  team_tag?: string;
  environment?: Environment;
  latency_ms?: number;
  request_id?: string;
}

export interface ModelPricing {
  provider: Provider;
  model: string;
  input_cost_per_million: number;
  output_cost_per_million: number;
  context_window: number;
}

export interface WeeklyReport {
  workspace_id: string;
  period_start: string;
  period_end: string;
  total_cost_cents: number;
  cost_change_pct: number;
  top_models: CostBreakdown[];
  top_features: { feature_tag: string; total_cost_cents: number }[];
  anomalies: AnomalyEvent[];
  recommendations: OptimizationRecommendation[];
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  estimated_savings_pct: number;
  estimated_savings_cents: number;
  source_model: string;
  target_model: string;
  confidence: number;
}
