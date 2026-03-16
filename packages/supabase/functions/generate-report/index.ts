import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CostByModel {
  provider: string;
  model: string;
  total_cost_cents: number;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface CostByTag {
  tag_value: string;
  total_cost_cents: number;
  request_count: number;
}

async function generateWeeklyReport(workspaceId: string): Promise<Record<string, unknown>> {
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodStart = new Date(periodEnd.getTime() - 7 * 86400000);
  const previousPeriodStart = new Date(periodStart.getTime() - 7 * 86400000);

  // Current period costs
  const { data: currentCosts } = await supabase.rpc("get_daily_costs", {
    p_workspace_id: workspaceId,
    p_start_date: periodStart.toISOString(),
    p_end_date: periodEnd.toISOString(),
  });

  // Previous period costs for comparison
  const { data: previousCosts } = await supabase.rpc("get_daily_costs", {
    p_workspace_id: workspaceId,
    p_start_date: previousPeriodStart.toISOString(),
    p_end_date: periodStart.toISOString(),
  });

  const currentTotal = (currentCosts ?? []).reduce(
    (sum: number, d: { total_cost_cents: number }) => sum + d.total_cost_cents,
    0
  );
  const previousTotal = (previousCosts ?? []).reduce(
    (sum: number, d: { total_cost_cents: number }) => sum + d.total_cost_cents,
    0
  );

  const costChangePct = previousTotal === 0
    ? (currentTotal > 0 ? 100 : 0)
    : ((currentTotal - previousTotal) / previousTotal) * 100;

  // Cost by model
  const { data: modelCosts } = await supabase.rpc("get_cost_by_model", {
    p_workspace_id: workspaceId,
    p_start_date: periodStart.toISOString(),
    p_end_date: periodEnd.toISOString(),
  });

  // Cost by feature
  const { data: featureCosts } = await supabase.rpc("get_cost_by_tag", {
    p_workspace_id: workspaceId,
    p_start_date: periodStart.toISOString(),
    p_end_date: periodEnd.toISOString(),
    p_tag_type: "feature",
  });

  // Anomalies this period
  const { data: anomalies } = await supabase
    .from("anomaly_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("detected_at", periodStart.toISOString())
    .lt("detected_at", periodEnd.toISOString())
    .order("detected_at", { ascending: false });

  // Generate optimization recommendations
  const recommendations = generateRecommendations(modelCosts as CostByModel[] ?? []);

  const report = {
    workspace_id: workspaceId,
    period_start: periodStart.toISOString().split("T")[0],
    period_end: periodEnd.toISOString().split("T")[0],
    total_cost_cents: currentTotal,
    cost_change_pct: Math.round(costChangePct * 100) / 100,
    top_models: (modelCosts as CostByModel[] ?? []).slice(0, 10).map((m) => ({
      provider: m.provider,
      model: m.model,
      total_cost_cents: m.total_cost_cents,
      request_count: m.request_count,
      input_tokens: m.total_input_tokens,
      output_tokens: m.total_output_tokens,
    })),
    top_features: (featureCosts as CostByTag[] ?? []).slice(0, 10).map((f) => ({
      feature_tag: f.tag_value,
      total_cost_cents: f.total_cost_cents,
    })),
    daily_breakdown: currentCosts ?? [],
    anomalies: anomalies ?? [],
    recommendations,
  };

  // Save snapshot
  await supabase.from("report_snapshots").insert({
    workspace_id: workspaceId,
    period_start: report.period_start,
    period_end: report.period_end,
    report_data: report,
  });

  return report;
}

function generateRecommendations(
  modelCosts: CostByModel[]
): Array<Record<string, unknown>> {
  const recommendations: Array<Record<string, unknown>> = [];

  // Model downgrade recommendations
  const modelAlternatives: Record<string, { target: string; savings_pct: number }> = {
    "gpt-4o": { target: "gpt-4o-mini", savings_pct: 94 },
    "gpt-4-turbo": { target: "gpt-4o-mini", savings_pct: 98 },
    "gpt-4": { target: "gpt-4o-mini", savings_pct: 99 },
    "claude-3-opus-20240229": { target: "claude-3-5-haiku-20241022", savings_pct: 94 },
    "claude-sonnet-4-20250514": { target: "claude-3-5-haiku-20241022", savings_pct: 73 },
    "gemini-1.5-pro": { target: "gemini-2.0-flash", savings_pct: 94 },
  };

  for (const model of modelCosts) {
    const alt = modelAlternatives[model.model];
    if (alt && model.total_cost_cents > 100) {
      const savingsCents = Math.round(model.total_cost_cents * (alt.savings_pct / 100));
      recommendations.push({
        id: `rec-${model.model}-${alt.target}`,
        title: `Consider ${alt.target} instead of ${model.model}`,
        description: `For simpler tasks currently using ${model.model}, switching to ${alt.target} could save up to ${alt.savings_pct}%. Review your usage to identify tasks that don't require the full capability of ${model.model}.`,
        estimated_savings_pct: alt.savings_pct,
        estimated_savings_cents: savingsCents,
        source_model: model.model,
        target_model: alt.target,
        confidence: 0.7,
      });
    }
  }

  // Check for high-volume, low-complexity patterns
  for (const model of modelCosts) {
    if (model.request_count > 1000 && model.total_input_tokens / model.request_count < 500) {
      recommendations.push({
        id: `rec-batch-${model.model}`,
        title: `Enable batching for ${model.model} requests`,
        description: `You have ${model.request_count} requests with an average of ${Math.round(model.total_input_tokens / model.request_count)} input tokens. Batching similar requests could reduce overhead and costs by 10-20%.`,
        estimated_savings_pct: 15,
        estimated_savings_cents: Math.round(model.total_cost_cents * 0.15),
        source_model: model.model,
        target_model: model.model,
        confidence: 0.6,
      });
    }
  }

  return recommendations.sort((a, b) =>
    (b.estimated_savings_cents as number) - (a.estimated_savings_cents as number)
  );
}

async function sendReportEmail(
  workspaceId: string,
  report: Record<string, unknown>
): Promise<void> {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return;

  // Get workspace members' emails
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .in("role", ["owner", "admin"]);

  if (!members?.length) return;

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: users } = await supabase.auth.admin.listUsers();
  const recipients = (users?.users ?? [])
    .filter((u) => userIds.includes(u.id) && u.email)
    .map((u) => u.email!);

  if (!recipients.length) return;

  const totalDollars = ((report.total_cost_cents as number) / 100).toFixed(2);
  const changePct = report.cost_change_pct as number;
  const changeDirection = changePct >= 0 ? "up" : "down";
  const changeIcon = changePct >= 0 ? "📈" : "📉";

  const topModels = (report.top_models as Array<{ model: string; total_cost_cents: number }>)
    .slice(0, 5)
    .map((m) => `<li>${m.model}: $${(m.total_cost_cents / 100).toFixed(2)}</li>`)
    .join("");

  const recommendations = (report.recommendations as Array<{ title: string; estimated_savings_cents: number }>)
    .slice(0, 3)
    .map((r) => `<li>${r.title} (save ~$${(r.estimated_savings_cents / 100).toFixed(2)})</li>`)
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a2e;">TokenLens Weekly Report</h1>
      <p>${report.period_start} to ${report.period_end}</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <h2 style="margin: 0;">Total Spend: $${totalDollars}</h2>
        <p style="color: ${changePct >= 0 ? "#dc2626" : "#16a34a"};">
          ${changeIcon} ${Math.abs(changePct).toFixed(1)}% ${changeDirection} from last week
        </p>
      </div>

      ${topModels ? `<h3>Top Models by Cost</h3><ul>${topModels}</ul>` : ""}
      ${recommendations ? `<h3>Optimization Opportunities</h3><ul>${recommendations}</ul>` : ""}

      <p><a href="${Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://app.tokenlens.dev"}/reports" style="color: #6366f1;">View Full Report →</a></p>
    </div>
  `;

  for (const email of recipients) {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: "reports@tokenlens.dev", name: "TokenLens Reports" },
        subject: `[TokenLens] Weekly Cost Report: $${totalDollars} (${changeDirection} ${Math.abs(changePct).toFixed(1)}%)`,
        content: [{ type: "text/html", value: html }],
      }),
    });
  }
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id");

    if (error) throw error;

    const results: Array<{ workspace_id: string; success: boolean; error?: string }> = [];

    for (const workspace of workspaces ?? []) {
      try {
        const report = await generateWeeklyReport(workspace.id);
        await sendReportEmail(workspace.id, report);
        results.push({ workspace_id: workspace.id, success: true });
      } catch (reportError) {
        const message = reportError instanceof Error ? reportError.message : "Unknown error";
        results.push({ workspace_id: workspace.id, success: false, error: message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
