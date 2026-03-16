import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ZSCORE_THRESHOLD = 2.5;
const LOOKBACK_DAYS = 14;
const MIN_DATA_POINTS = 5;

interface DailyCost {
  day: string;
  total_cost_cents: number;
  request_count: number;
}

function calculateZScore(value: number, data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (data.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function determineSeverity(zScore: number): "low" | "medium" | "high" | "critical" {
  const absZ = Math.abs(zScore);
  if (absZ >= 4) return "critical";
  if (absZ >= 3.5) return "high";
  if (absZ >= 3) return "medium";
  return "low";
}

async function sendSlackNotification(webhookUrl: string, message: string): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: message },
        },
      ],
    }),
  });
}

async function sendEmailNotification(
  email: string,
  subject: string,
  body: string
): Promise<void> {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) return;

  await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: "alerts@tokenlens.dev", name: "TokenLens Alerts" },
      subject,
      content: [{ type: "text/html", value: body }],
    }),
  });
}

async function checkBudgetAlerts(workspaceId: string): Promise<void> {
  const { data: alerts } = await supabase
    .from("budget_alerts")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (!alerts?.length) return;

  const now = new Date();

  for (const alert of alerts) {
    let periodStart: Date;
    switch (alert.period) {
      case "daily":
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly": {
        const dayOfWeek = now.getDay();
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - dayOfWeek);
        periodStart.setHours(0, 0, 0, 0);
        break;
      }
      case "monthly":
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    let query = supabase
      .from("usage_records")
      .select("total_cost_cents")
      .eq("workspace_id", workspaceId)
      .gte("recorded_at", periodStart.toISOString());

    // Apply scope filters
    if (alert.scope?.provider) {
      query = query.eq("provider", alert.scope.provider);
    }
    if (alert.scope?.model) {
      query = query.eq("model", alert.scope.model);
    }
    if (alert.scope?.feature_tag) {
      query = query.eq("feature_tag", alert.scope.feature_tag);
    }
    if (alert.scope?.team_tag) {
      query = query.eq("team_tag", alert.scope.team_tag);
    }

    const { data: records } = await query;
    if (!records) continue;

    const totalCents = records.reduce(
      (sum: number, r: { total_cost_cents: number }) => sum + r.total_cost_cents,
      0
    );

    if (totalCents >= alert.threshold_cents) {
      // Don't re-trigger within the same period
      if (alert.triggered_at) {
        const triggeredDate = new Date(alert.triggered_at);
        if (triggeredDate >= periodStart) continue;
      }

      // Mark as triggered
      await supabase
        .from("budget_alerts")
        .update({ triggered_at: now.toISOString() })
        .eq("id", alert.id);

      // Send notifications
      const costDollars = (totalCents / 100).toFixed(2);
      const thresholdDollars = (alert.threshold_cents / 100).toFixed(2);
      const message = `*Budget Alert: ${alert.name}*\nSpend has reached $${costDollars} (threshold: $${thresholdDollars}) for the ${alert.period} period.`;

      for (const channel of alert.notify_channels ?? []) {
        if (channel.startsWith("https://hooks.slack.com/")) {
          await sendSlackNotification(channel, message);
        } else if (channel.includes("@")) {
          await sendEmailNotification(
            channel,
            `[TokenLens] Budget Alert: ${alert.name}`,
            `<h2>Budget Alert Triggered</h2>
            <p><strong>${alert.name}</strong></p>
            <p>Current spend: <strong>$${costDollars}</strong></p>
            <p>Threshold: $${thresholdDollars}</p>
            <p>Period: ${alert.period}</p>
            <p><a href="${Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://app.tokenlens.dev"}/alerts">View in TokenLens</a></p>`
          );
        }
      }
    }
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

    // Get all workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from("workspaces")
      .select("id");

    if (wsError) throw wsError;

    const anomalies: Array<Record<string, unknown>> = [];
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);

    for (const workspace of workspaces ?? []) {
      // Get daily costs for the lookback window
      const { data: dailyCosts } = await supabase.rpc("get_daily_costs", {
        p_workspace_id: workspace.id,
        p_start_date: lookbackStart.toISOString(),
        p_end_date: now.toISOString(),
      });

      if (!dailyCosts || dailyCosts.length < MIN_DATA_POINTS) continue;

      const costs = (dailyCosts as DailyCost[]).map((d) => d.total_cost_cents);
      const counts = (dailyCosts as DailyCost[]).map((d) => d.request_count);

      // Check the most recent day for anomalies
      const latestCost = costs[costs.length - 1]!;
      const latestCount = counts[counts.length - 1]!;
      const historicalCosts = costs.slice(0, -1);
      const historicalCounts = counts.slice(0, -1);

      // Cost anomaly
      const costZScore = calculateZScore(latestCost, historicalCosts);
      if (Math.abs(costZScore) >= ZSCORE_THRESHOLD) {
        const expectedCost = historicalCosts.reduce((a, b) => a + b, 0) / historicalCosts.length;
        const severity = determineSeverity(costZScore);

        anomalies.push({
          workspace_id: workspace.id,
          detected_at: now.toISOString(),
          metric: "daily_cost",
          expected_value: Math.round(expectedCost),
          actual_value: latestCost,
          severity,
          description: `Daily cost of $${(latestCost / 100).toFixed(2)} is ${costZScore > 0 ? "above" : "below"} expected ($${(expectedCost / 100).toFixed(2)}). Z-score: ${costZScore.toFixed(2)}.`,
        });
      }

      // Request volume anomaly
      const countZScore = calculateZScore(latestCount, historicalCounts);
      if (Math.abs(countZScore) >= ZSCORE_THRESHOLD) {
        const expectedCount = historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length;
        const severity = determineSeverity(countZScore);

        anomalies.push({
          workspace_id: workspace.id,
          detected_at: now.toISOString(),
          metric: "daily_request_count",
          expected_value: Math.round(expectedCount),
          actual_value: latestCount,
          severity,
          description: `Daily request count of ${latestCount} is ${countZScore > 0 ? "above" : "below"} expected (${Math.round(expectedCount)}). Z-score: ${countZScore.toFixed(2)}.`,
        });
      }

      // Check budget alerts for this workspace
      await checkBudgetAlerts(workspace.id);
    }

    // Insert anomalies
    if (anomalies.length > 0) {
      const { error: insertError } = await supabase.from("anomaly_events").insert(anomalies);
      if (insertError) throw insertError;

      // Notify about high/critical anomalies
      for (const anomaly of anomalies) {
        if (anomaly.severity === "high" || anomaly.severity === "critical") {
          const { data: alerts } = await supabase
            .from("budget_alerts")
            .select("notify_channels")
            .eq("workspace_id", anomaly.workspace_id);

          const channels = new Set<string>();
          for (const alert of alerts ?? []) {
            for (const ch of alert.notify_channels ?? []) {
              channels.add(ch);
            }
          }

          for (const channel of channels) {
            if (channel.startsWith("https://hooks.slack.com/")) {
              await sendSlackNotification(
                channel,
                `*Anomaly Detected (${anomaly.severity})*\n${anomaly.description}`
              );
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, anomalies_detected: anomalies.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
