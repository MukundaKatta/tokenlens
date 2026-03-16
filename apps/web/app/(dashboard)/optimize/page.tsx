import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCost } from "@tokenlens/shared";
import { generateRecommendations } from "@/lib/optimizer/recommendations";
import { OptimizeClient } from "./optimize-client";

export default async function OptimizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/login");
  const workspaceId = membership.workspace_id;

  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 86400000);

  // Get model costs for recommendations
  const { data: modelCosts } = await supabase.rpc("get_cost_by_model", {
    p_workspace_id: workspaceId,
    p_start_date: last30Days.toISOString(),
    p_end_date: now.toISOString(),
  });

  const breakdowns = (modelCosts ?? []).map(
    (m: {
      provider: string;
      model: string;
      total_cost_cents: number;
      request_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
    }) => ({
      provider: m.provider,
      model: m.model,
      total_cost_cents: m.total_cost_cents,
      request_count: m.request_count,
      input_tokens: m.total_input_tokens,
      output_tokens: m.total_output_tokens,
    })
  );

  const recommendations = generateRecommendations(breakdowns);
  const totalSavings = recommendations.reduce(
    (sum, r) => sum + r.estimated_savings_cents,
    0
  );

  // Get existing optimization rules
  const { data: rules } = await supabase
    .from("optimization_rules")
    .select("*")
    .eq("workspace_id", workspaceId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Optimize</h1>
        <p className="mt-1 text-muted-foreground">
          AI-generated recommendations to reduce your LLM costs.
        </p>
      </div>

      {/* Summary Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Potential Monthly Savings
            </div>
            <div className="text-3xl font-bold text-primary">
              {formatCost(totalSavings)}
            </div>
            <div className="text-sm text-muted-foreground">
              Based on {recommendations.length} recommendations
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              Active Rules
            </div>
            <div className="text-2xl font-bold text-foreground">
              {(rules ?? []).filter((r) => r.active).length}
            </div>
          </div>
        </CardContent>
      </Card>

      <OptimizeClient
        recommendations={recommendations}
        workspaceId={workspaceId}
      />
    </div>
  );
}
