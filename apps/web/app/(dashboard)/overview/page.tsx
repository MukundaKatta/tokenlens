import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCost, formatNumber, percentChange } from "@tokenlens/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewCharts } from "./overview-charts";
import {
  DollarSign,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
} from "lucide-react";

export default async function OverviewPage() {
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

  // Date ranges
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last30DaysStart = new Date(now.getTime() - 30 * 86400000);

  // Current month spend
  const { data: currentRecords } = await supabase
    .from("usage_records")
    .select("total_cost_cents, input_tokens, output_tokens")
    .eq("workspace_id", workspaceId)
    .gte("recorded_at", thisMonthStart.toISOString());

  const currentSpendCents = (currentRecords ?? []).reduce(
    (sum, r) => sum + r.total_cost_cents,
    0
  );
  const currentRequests = (currentRecords ?? []).length;
  const currentTokens = (currentRecords ?? []).reduce(
    (sum, r) => sum + r.input_tokens + r.output_tokens,
    0
  );

  // Last month spend for comparison
  const { data: lastRecords } = await supabase
    .from("usage_records")
    .select("total_cost_cents")
    .eq("workspace_id", workspaceId)
    .gte("recorded_at", lastMonthStart.toISOString())
    .lt("recorded_at", thisMonthStart.toISOString());

  const lastSpendCents = (lastRecords ?? []).reduce(
    (sum, r) => sum + r.total_cost_cents,
    0
  );
  const lastRequests = (lastRecords ?? []).length;
  const spendChange = percentChange(currentSpendCents, lastSpendCents);
  const requestChange = percentChange(currentRequests, lastRequests);

  // Active anomalies
  const { count: anomalyCount } = await supabase
    .from("anomaly_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("acknowledged", false)
    .gte("detected_at", last30DaysStart.toISOString());

  // Daily costs for chart
  const { data: dailyCosts } = await supabase.rpc("get_daily_costs", {
    p_workspace_id: workspaceId,
    p_start_date: last30DaysStart.toISOString(),
    p_end_date: now.toISOString(),
  });

  // Cost by model
  const { data: modelCosts } = await supabase.rpc("get_cost_by_model", {
    p_workspace_id: workspaceId,
    p_start_date: last30DaysStart.toISOString(),
    p_end_date: now.toISOString(),
  });

  const trendData = (dailyCosts ?? []).map(
    (d: { day: string; total_cost_cents: number; request_count: number }) => ({
      date: d.day,
      total_cost_cents: d.total_cost_cents,
      request_count: d.request_count,
    })
  );

  const breakdownData = (modelCosts ?? []).slice(0, 7).map(
    (m: { model: string; total_cost_cents: number }) => ({
      name: m.model,
      value: m.total_cost_cents,
      percentage:
        currentSpendCents > 0
          ? (m.total_cost_cents / currentSpendCents) * 100
          : 0,
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Your AI spending at a glance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Spend
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(currentSpendCents)}</div>
            <div className={`flex items-center text-xs ${spendChange >= 0 ? "text-destructive" : "text-success"}`}>
              {spendChange >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(spendChange).toFixed(1)}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Requests
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(currentRequests)}</div>
            <div className={`flex items-center text-xs ${requestChange >= 0 ? "text-muted-foreground" : "text-success"}`}>
              {requestChange >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(requestChange).toFixed(1)}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(currentTokens)}</div>
            <div className="text-xs text-muted-foreground">This month</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Anomalies
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalyCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              Unacknowledged
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <OverviewCharts trendData={trendData} breakdownData={breakdownData} />
    </div>
  );
}
