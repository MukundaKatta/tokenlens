import type { ModelPricing, Provider } from "./types";

/**
 * Canonical model pricing table.
 * Costs are in USD per 1 million tokens.
 * Updated periodically — prices reflect public list prices as of early 2025.
 */
export const MODEL_PRICING: ModelPricing[] = [
  // OpenAI
  { provider: "openai", model: "gpt-4o", input_cost_per_million: 2500, output_cost_per_million: 10000, context_window: 128_000 },
  { provider: "openai", model: "gpt-4o-mini", input_cost_per_million: 150, output_cost_per_million: 600, context_window: 128_000 },
  { provider: "openai", model: "gpt-4-turbo", input_cost_per_million: 10000, output_cost_per_million: 30000, context_window: 128_000 },
  { provider: "openai", model: "gpt-4", input_cost_per_million: 30000, output_cost_per_million: 60000, context_window: 8_192 },
  { provider: "openai", model: "gpt-3.5-turbo", input_cost_per_million: 500, output_cost_per_million: 1500, context_window: 16_385 },
  { provider: "openai", model: "o1", input_cost_per_million: 15000, output_cost_per_million: 60000, context_window: 200_000 },
  { provider: "openai", model: "o1-mini", input_cost_per_million: 3000, output_cost_per_million: 12000, context_window: 128_000 },
  { provider: "openai", model: "o3-mini", input_cost_per_million: 1100, output_cost_per_million: 4400, context_window: 200_000 },

  // Anthropic
  { provider: "anthropic", model: "claude-sonnet-4-20250514", input_cost_per_million: 3000, output_cost_per_million: 15000, context_window: 200_000 },
  { provider: "anthropic", model: "claude-3-5-haiku-20241022", input_cost_per_million: 800, output_cost_per_million: 4000, context_window: 200_000 },
  { provider: "anthropic", model: "claude-3-opus-20240229", input_cost_per_million: 15000, output_cost_per_million: 75000, context_window: 200_000 },
  { provider: "anthropic", model: "claude-3-haiku-20240307", input_cost_per_million: 250, output_cost_per_million: 1250, context_window: 200_000 },

  // AWS Bedrock (same models, Bedrock pricing)
  { provider: "aws_bedrock", model: "anthropic.claude-sonnet-4-20250514-v1:0", input_cost_per_million: 3000, output_cost_per_million: 15000, context_window: 200_000 },
  { provider: "aws_bedrock", model: "anthropic.claude-3-haiku-20240307-v1:0", input_cost_per_million: 250, output_cost_per_million: 1250, context_window: 200_000 },
  { provider: "aws_bedrock", model: "amazon.titan-text-express-v1", input_cost_per_million: 200, output_cost_per_million: 600, context_window: 8_000 },
  { provider: "aws_bedrock", model: "meta.llama3-70b-instruct-v1:0", input_cost_per_million: 2650, output_cost_per_million: 3500, context_window: 8_000 },

  // Google Vertex AI
  { provider: "google_vertex", model: "gemini-2.0-flash", input_cost_per_million: 75, output_cost_per_million: 300, context_window: 1_000_000 },
  { provider: "google_vertex", model: "gemini-1.5-pro", input_cost_per_million: 1250, output_cost_per_million: 5000, context_window: 2_000_000 },
  { provider: "google_vertex", model: "gemini-1.5-flash", input_cost_per_million: 75, output_cost_per_million: 300, context_window: 1_000_000 },

  // Azure OpenAI (mirrors OpenAI pricing)
  { provider: "azure_openai", model: "gpt-4o", input_cost_per_million: 2500, output_cost_per_million: 10000, context_window: 128_000 },
  { provider: "azure_openai", model: "gpt-4o-mini", input_cost_per_million: 150, output_cost_per_million: 600, context_window: 128_000 },
];

/**
 * Calculate the cost in cents for a given usage.
 */
export function calculateCostCents(
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING.find(
    (p) => p.provider === provider && p.model === model
  );

  if (!pricing) {
    // Fallback: use a generic cost estimate based on provider averages
    const providerModels = MODEL_PRICING.filter((p) => p.provider === provider);
    if (providerModels.length === 0) {
      // Unknown provider, use conservative estimate
      return Math.round(
        (inputTokens * 5000 + outputTokens * 15000) / 1_000_000
      );
    }
    const avgInput =
      providerModels.reduce((s, p) => s + p.input_cost_per_million, 0) /
      providerModels.length;
    const avgOutput =
      providerModels.reduce((s, p) => s + p.output_cost_per_million, 0) /
      providerModels.length;
    return Math.round(
      (inputTokens * avgInput + outputTokens * avgOutput) / 1_000_000
    );
  }

  const inputCost =
    (inputTokens * pricing.input_cost_per_million) / 1_000_000;
  const outputCost =
    (outputTokens * pricing.output_cost_per_million) / 1_000_000;

  return Math.round(inputCost + outputCost);
}

/**
 * Find cheaper alternative models that can handle the same task.
 */
export function findCheaperAlternatives(
  currentProvider: Provider,
  currentModel: string,
  maxContextNeeded: number
): ModelPricing[] {
  const current = MODEL_PRICING.find(
    (p) => p.provider === currentProvider && p.model === currentModel
  );
  if (!current) return [];

  const currentAvgCost =
    (current.input_cost_per_million + current.output_cost_per_million) / 2;

  return MODEL_PRICING.filter(
    (p) =>
      p.context_window >= maxContextNeeded &&
      (p.input_cost_per_million + p.output_cost_per_million) / 2 <
        currentAvgCost * 0.7 // At least 30% cheaper
  ).sort(
    (a, b) =>
      a.input_cost_per_million +
      a.output_cost_per_million -
      (b.input_cost_per_million + b.output_cost_per_million)
  );
}

/**
 * Get the display-friendly model name.
 */
export function getModelDisplayName(model: string): string {
  const nameMap: Record<string, string> = {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4": "GPT-4",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    "o1": "o1",
    "o1-mini": "o1 Mini",
    "o3-mini": "o3 Mini",
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
    "claude-3-opus-20240229": "Claude 3 Opus",
    "claude-3-haiku-20240307": "Claude 3 Haiku",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "gemini-1.5-flash": "Gemini 1.5 Flash",
  };
  return nameMap[model] ?? model;
}
