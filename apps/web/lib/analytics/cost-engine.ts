import { createClient } from "@/lib/supabase/server";
import type { CostBreakdown, CostTrend, CostForecast } from "@tokenlens/shared";
import { linearRegression, dateRange } from "@tokenlens/shared";

export async function getDailyCosts(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<CostTrend[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_costs", {
    p_workspace_id: workspaceId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) throw new Error(`Failed to get daily costs: ${error.message}`);

  return (data ?? []).map((d: { day: string; total_cost_cents: number; request_count: number }) => ({
    date: d.day,
    total_cost_cents: d.total_cost_cents,
    request_count: d.request_count,
  }));
}

export async function getCostByModel(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<CostBreakdown[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cost_by_model", {
    p_workspace_id: workspaceId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) throw new Error(`Failed to get cost by model: ${error.message}`);

  return (data ?? []).map(
    (d: {
      provider: string;
      model: string;
      total_cost_cents: number;
      request_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
    }) => ({
      provider: d.provider,
      model: d.model,
      total_cost_cents: d.total_cost_cents,
      request_count: d.request_count,
      input_tokens: d.total_input_tokens,
      output_tokens: d.total_output_tokens,
    })
  );
}

export async function getCostByTag(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
  tagType: "feature" | "team" | "user"
): Promise<Array<{ tag: string; total_cost_cents: number; request_count: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cost_by_tag", {
    p_workspace_id: workspaceId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_tag_type: tagType,
  });

  if (error) throw new Error(`Failed to get cost by ${tagType}: ${error.message}`);

  return (data ?? []).map((d: { tag_value: string; total_cost_cents: number; request_count: number }) => ({
    tag: d.tag_value,
    total_cost_cents: d.total_cost_cents,
    request_count: d.request_count,
  }));
}

export async function getTotalSpend(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<{ total_cost_cents: number; request_count: number; total_tokens: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usage_records")
    .select("total_cost_cents, input_tokens, output_tokens")
    .eq("workspace_id", workspaceId)
    .gte("recorded_at", startDate.toISOString())
    .lt("recorded_at", endDate.toISOString());

  if (error) throw new Error(`Failed to get total spend: ${error.message}`);

  const records = data ?? [];
  return {
    total_cost_cents: records.reduce((sum, r) => sum + r.total_cost_cents, 0),
    request_count: records.length,
    total_tokens: records.reduce(
      (sum, r) => sum + r.input_tokens + r.output_tokens,
      0
    ),
  };
}

export function generateForecast(
  historicalData: CostTrend[],
  horizonDays: number = 30
): CostForecast[] {
  if (historicalData.length < 7) {
    // Not enough data for meaningful forecast
    const avgCost =
      historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.total_cost_cents, 0) /
          historicalData.length
        : 0;

    const lastDate = historicalData.length > 0
      ? new Date(historicalData[historicalData.length - 1]!.date)
      : new Date();

    return Array.from({ length: horizonDays }, (_, i) => {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i + 1);
      return {
        date: date.toISOString().split("T")[0]!,
        projected_cost_cents: Math.round(avgCost),
        lower_bound_cents: Math.round(avgCost * 0.7),
        upper_bound_cents: Math.round(avgCost * 1.3),
      };
    });
  }

  // Use linear regression for trend
  const x = historicalData.map((_, i) => i);
  const y = historicalData.map((d) => d.total_cost_cents);
  const { slope, intercept, r2 } = linearRegression(x, y);

  // Calculate residual standard deviation for confidence intervals
  const predictions = x.map((xi) => slope * xi + intercept);
  const residuals = y.map((yi, i) => yi - predictions[i]!);
  const residualStdDev = Math.sqrt(
    residuals.reduce((sum, r) => sum + r * r, 0) / (residuals.length - 2)
  );

  const lastDate = new Date(historicalData[historicalData.length - 1]!.date);
  const n = historicalData.length;

  // Uncertainty grows further into the future
  const confidenceMultiplier = r2 > 0.7 ? 1.5 : r2 > 0.4 ? 2.0 : 3.0;

  return Array.from({ length: horizonDays }, (_, i) => {
    const futureX = n + i;
    const projected = Math.max(0, Math.round(slope * futureX + intercept));
    const uncertainty = residualStdDev * confidenceMultiplier * Math.sqrt(1 + (i + 1) / n);

    const date = new Date(lastDate);
    date.setDate(date.getDate() + i + 1);

    return {
      date: date.toISOString().split("T")[0]!,
      projected_cost_cents: projected,
      lower_bound_cents: Math.max(0, Math.round(projected - uncertainty)),
      upper_bound_cents: Math.round(projected + uncertainty),
    };
  });
}
