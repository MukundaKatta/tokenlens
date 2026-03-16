import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BreakdownTabs } from "./breakdown-tabs";

export default async function BreakdownPage() {
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

  // Get breakdowns by different dimensions
  const { data: modelCosts } = await supabase.rpc("get_cost_by_model", {
    p_workspace_id: workspaceId,
    p_start_date: last30Days.toISOString(),
    p_end_date: now.toISOString(),
  });

  const { data: featureCosts } = await supabase.rpc("get_cost_by_tag", {
    p_workspace_id: workspaceId,
    p_start_date: last30Days.toISOString(),
    p_end_date: now.toISOString(),
    p_tag_type: "feature",
  });

  const { data: teamCosts } = await supabase.rpc("get_cost_by_tag", {
    p_workspace_id: workspaceId,
    p_start_date: last30Days.toISOString(),
    p_end_date: now.toISOString(),
    p_tag_type: "team",
  });

  const { data: userCosts } = await supabase.rpc("get_cost_by_tag", {
    p_workspace_id: workspaceId,
    p_start_date: last30Days.toISOString(),
    p_end_date: now.toISOString(),
    p_tag_type: "user",
  });

  // Cost by environment
  const { data: envRecords } = await supabase
    .from("usage_records")
    .select("environment, total_cost_cents")
    .eq("workspace_id", workspaceId)
    .gte("recorded_at", last30Days.toISOString());

  const envCosts = Object.entries(
    (envRecords ?? []).reduce(
      (acc, r) => {
        const env = r.environment ?? "production";
        acc[env] = (acc[env] ?? 0) + r.total_cost_cents;
        return acc;
      },
      {} as Record<string, number>
    )
  )
    .map(([env, cost]) => ({ tag: env, total_cost_cents: cost, request_count: 0 }))
    .sort((a, b) => b.total_cost_cents - a.total_cost_cents);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cost Breakdown</h1>
        <p className="mt-1 text-muted-foreground">
          Understand where your AI spend goes - by model, feature, team, and
          more.
        </p>
      </div>

      <BreakdownTabs
        modelData={(modelCosts ?? []).map(
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
            input_tokens: m.total_input_tokens,
            output_tokens: m.total_output_tokens,
            total_cost_cents: m.total_cost_cents,
            request_count: m.request_count,
          })
        )}
        featureData={(featureCosts ?? []).map(
          (f: { tag_value: string; total_cost_cents: number; request_count: number }) => ({
            tag: f.tag_value,
            total_cost_cents: f.total_cost_cents,
            request_count: f.request_count,
          })
        )}
        teamData={(teamCosts ?? []).map(
          (t: { tag_value: string; total_cost_cents: number; request_count: number }) => ({
            tag: t.tag_value,
            total_cost_cents: t.total_cost_cents,
            request_count: t.request_count,
          })
        )}
        userData={(userCosts ?? []).map(
          (u: { tag_value: string; total_cost_cents: number; request_count: number }) => ({
            tag: u.tag_value,
            total_cost_cents: u.total_cost_cents,
            request_count: u.request_count,
          })
        )}
        envData={envCosts}
      />
    </div>
  );
}
