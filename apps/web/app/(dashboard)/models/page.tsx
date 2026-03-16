import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelPricingTable } from "@/components/tables/model-pricing-table";
import { ModelsClient } from "./models-client";

export default async function ModelsPage() {
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

  // Get model costs with latency
  const { data: modelCosts } = await supabase.rpc("get_cost_by_model", {
    p_workspace_id: workspaceId,
    p_start_date: last30Days.toISOString(),
    p_end_date: now.toISOString(),
  });

  // Get optimization rules
  const { data: rules } = await supabase
    .from("optimization_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const modelData = (modelCosts ?? []).map(
    (m: {
      provider: string;
      model: string;
      total_cost_cents: number;
      request_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
    }) => ({
      model: m.model,
      provider: m.provider,
      cost_cents: m.total_cost_cents,
      requests: m.request_count,
      input_tokens: m.total_input_tokens,
      output_tokens: m.total_output_tokens,
      avg_latency_ms: 0,
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Models</h1>
        <p className="mt-1 text-muted-foreground">
          Compare models, analyze performance, and configure routing rules.
        </p>
      </div>

      <ModelsClient modelData={modelData} rules={rules ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>Model Pricing Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelPricingTable />
        </CardContent>
      </Card>
    </div>
  );
}
