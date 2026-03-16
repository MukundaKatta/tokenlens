import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AlertsClient } from "./alerts-client";

export default async function AlertsPage() {
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

  // Get budget alerts
  const { data: alerts } = await supabase
    .from("budget_alerts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Get anomaly events
  const { data: anomalies } = await supabase
    .from("anomaly_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("detected_at", { ascending: false })
    .limit(50);

  // Get current period spend for each alert
  const now = new Date();
  const alertsWithSpend = await Promise.all(
    (alerts ?? []).map(async (alert) => {
      let periodStart: Date;
      switch (alert.period) {
        case "daily":
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "weekly": {
          const day = now.getDay();
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - day);
          periodStart.setHours(0, 0, 0, 0);
          break;
        }
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      let query = supabase
        .from("usage_records")
        .select("total_cost_cents")
        .eq("workspace_id", workspaceId)
        .gte("recorded_at", periodStart.toISOString());

      if (alert.scope?.provider) query = query.eq("provider", alert.scope.provider);
      if (alert.scope?.model) query = query.eq("model", alert.scope.model);

      const { data: records } = await query;
      const spend = (records ?? []).reduce(
        (sum: number, r: { total_cost_cents: number }) => sum + r.total_cost_cents,
        0
      );

      return { alert, currentSpendCents: spend };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Alerts</h1>
        <p className="mt-1 text-muted-foreground">
          Set budget thresholds and monitor anomalies to stay on top of costs.
        </p>
      </div>

      <AlertsClient
        alertsWithSpend={alertsWithSpend}
        anomalies={anomalies ?? []}
        workspaceId={workspaceId}
      />
    </div>
  );
}
