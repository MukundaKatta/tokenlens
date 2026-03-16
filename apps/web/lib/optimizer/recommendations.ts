import type {
  CostBreakdown,
  OptimizationRecommendation,
  Provider,
} from "@tokenlens/shared";
import { findCheaperAlternatives, getModelDisplayName } from "@tokenlens/shared";

interface UsagePattern {
  model: string;
  provider: Provider;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCostCents: number;
  requestCount: number;
}

/**
 * Generate optimization recommendations based on usage patterns.
 */
export function generateRecommendations(
  breakdowns: CostBreakdown[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  let recId = 0;

  for (const breakdown of breakdowns) {
    if (breakdown.total_cost_cents < 50) continue; // Skip insignificant costs

    const pattern: UsagePattern = {
      model: breakdown.model,
      provider: breakdown.provider as Provider,
      avgInputTokens: Math.round(breakdown.input_tokens / Math.max(breakdown.request_count, 1)),
      avgOutputTokens: Math.round(breakdown.output_tokens / Math.max(breakdown.request_count, 1)),
      totalCostCents: breakdown.total_cost_cents,
      requestCount: breakdown.request_count,
    };

    // Check for model downgrade opportunities
    const modelDowngrades = checkModelDowngrade(pattern);
    recommendations.push(...modelDowngrades.map((r) => ({ ...r, id: `rec-${++recId}` })));

    // Check for batching opportunities
    const batchingRec = checkBatchingOpportunity(pattern);
    if (batchingRec) {
      recommendations.push({ ...batchingRec, id: `rec-${++recId}` });
    }

    // Check for caching opportunities
    const cachingRec = checkCachingOpportunity(pattern);
    if (cachingRec) {
      recommendations.push({ ...cachingRec, id: `rec-${++recId}` });
    }

    // Check for prompt optimization
    const promptRec = checkPromptOptimization(pattern);
    if (promptRec) {
      recommendations.push({ ...promptRec, id: `rec-${++recId}` });
    }
  }

  // Sort by estimated savings (highest first)
  return recommendations.sort(
    (a, b) => b.estimated_savings_cents - a.estimated_savings_cents
  );
}

function checkModelDowngrade(
  pattern: UsagePattern
): Omit<OptimizationRecommendation, "id">[] {
  const results: Omit<OptimizationRecommendation, "id">[] = [];
  const maxContext = pattern.avgInputTokens + pattern.avgOutputTokens;
  const alternatives = findCheaperAlternatives(
    pattern.provider,
    pattern.model,
    maxContext
  );

  if (alternatives.length === 0) return results;

  // Only recommend the best alternative
  const best = alternatives[0]!;
  const currentDisplayName = getModelDisplayName(pattern.model);
  const targetDisplayName = getModelDisplayName(best.model);

  const currentCostPer1M =
    (best.input_cost_per_million + best.output_cost_per_million) / 2;
  const avgTokens = (pattern.avgInputTokens + pattern.avgOutputTokens) / 2;

  // Estimate savings conservatively (assume only 50% of traffic can be migrated)
  const migrationRate = pattern.avgInputTokens < 2000 ? 0.7 : 0.3;
  const savingsCents = Math.round(
    pattern.totalCostCents * migrationRate * 0.5 // 50% discount for being conservative
  );
  const savingsPct = Math.round(
    (savingsCents / Math.max(pattern.totalCostCents, 1)) * 100
  );

  if (savingsCents > 10) {
    results.push({
      title: `Switch simple tasks from ${currentDisplayName} to ${targetDisplayName}`,
      description: `Your average request uses ${pattern.avgInputTokens} input tokens. For tasks with shorter prompts, ${targetDisplayName} (${best.provider}) offers comparable quality at significantly lower cost. We estimate ${migrationRate * 100}% of your ${pattern.requestCount} requests could be migrated.`,
      estimated_savings_pct: savingsPct,
      estimated_savings_cents: savingsCents,
      source_model: pattern.model,
      target_model: best.model,
      confidence: pattern.avgInputTokens < 1000 ? 0.8 : 0.6,
    });
  }

  return results;
}

function checkBatchingOpportunity(
  pattern: UsagePattern
): Omit<OptimizationRecommendation, "id"> | null {
  // If many small requests, suggest batching
  if (pattern.requestCount < 500 || pattern.avgInputTokens > 1000) return null;

  const savingsPct = 15;
  const savingsCents = Math.round(pattern.totalCostCents * 0.15);
  if (savingsCents < 10) return null;

  return {
    title: `Batch ${getModelDisplayName(pattern.model)} requests`,
    description: `You made ${pattern.requestCount} requests averaging only ${pattern.avgInputTokens} input tokens each. Batching similar requests together can reduce per-request overhead and potentially qualify for batch API discounts (up to 50% with OpenAI Batch API).`,
    estimated_savings_pct: savingsPct,
    estimated_savings_cents: savingsCents,
    source_model: pattern.model,
    target_model: pattern.model,
    confidence: 0.65,
  };
}

function checkCachingOpportunity(
  pattern: UsagePattern
): Omit<OptimizationRecommendation, "id"> | null {
  // High request count with consistent input size suggests cacheable prompts
  if (pattern.requestCount < 100) return null;

  // Estimate 20% of requests might be duplicates
  const duplicationRate = 0.2;
  const savingsCents = Math.round(pattern.totalCostCents * duplicationRate);
  if (savingsCents < 10) return null;

  return {
    title: `Enable response caching for ${getModelDisplayName(pattern.model)}`,
    description: `With ${pattern.requestCount} requests, implementing semantic caching for identical or near-identical prompts could eliminate redundant API calls. Consider using prompt hashing with a TTL-based cache (Redis or in-memory).`,
    estimated_savings_pct: Math.round(duplicationRate * 100),
    estimated_savings_cents: savingsCents,
    source_model: pattern.model,
    target_model: pattern.model,
    confidence: 0.5,
  };
}

function checkPromptOptimization(
  pattern: UsagePattern
): Omit<OptimizationRecommendation, "id"> | null {
  // If average input tokens is very high, suggest prompt optimization
  if (pattern.avgInputTokens < 3000) return null;

  const reductionRate = 0.25; // Assume 25% reduction possible
  const inputShareOfCost = 0.4; // Rough estimate
  const savingsCents = Math.round(
    pattern.totalCostCents * inputShareOfCost * reductionRate
  );
  if (savingsCents < 10) return null;

  return {
    title: `Optimize prompts for ${getModelDisplayName(pattern.model)}`,
    description: `Your average prompt is ${pattern.avgInputTokens} tokens. Techniques like prompt compression, removing redundant instructions, or using structured outputs can reduce input tokens by 20-30% without affecting quality.`,
    estimated_savings_pct: Math.round(inputShareOfCost * reductionRate * 100),
    estimated_savings_cents: savingsCents,
    source_model: pattern.model,
    target_model: pattern.model,
    confidence: 0.55,
  };
}
