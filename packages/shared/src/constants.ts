export const PROVIDERS = [
  "openai",
  "anthropic",
  "aws_bedrock",
  "google_vertex",
  "azure_openai",
  "custom",
] as const;

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  aws_bedrock: "AWS Bedrock",
  google_vertex: "Google Vertex AI",
  azure_openai: "Azure OpenAI",
  custom: "Custom",
};

export const PLAN_LIMITS = {
  free: {
    max_workspaces: 1,
    max_provider_connections: 2,
    max_budget_alerts: 3,
    max_optimization_rules: 2,
    retention_days: 30,
    max_requests_per_day: 10_000,
  },
  pro: {
    max_workspaces: 5,
    max_provider_connections: 10,
    max_budget_alerts: 25,
    max_optimization_rules: 20,
    retention_days: 365,
    max_requests_per_day: 1_000_000,
  },
  enterprise: {
    max_workspaces: -1,
    max_provider_connections: -1,
    max_budget_alerts: -1,
    max_optimization_rules: -1,
    retention_days: -1,
    max_requests_per_day: -1,
  },
} as const;

export const ALERT_PERIODS = ["daily", "weekly", "monthly"] as const;

export const ENVIRONMENTS = [
  "production",
  "staging",
  "development",
  "test",
] as const;

export const API_VERSION = "2024-01-01";

export const MAX_INGEST_BATCH_SIZE = 1000;

export const ANOMALY_DETECTION_WINDOW_DAYS = 14;
export const ANOMALY_ZSCORE_THRESHOLD = 2.5;

export const FORECAST_LOOKBACK_DAYS = 90;
export const FORECAST_HORIZON_DAYS = 30;
