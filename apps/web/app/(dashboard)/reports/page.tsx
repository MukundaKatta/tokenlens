import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatNumber } from "@tokenlens/shared";
import { FileText, TrendingUp, TrendingDown } from "lucide-react";

export default async function ReportsPage() {
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

  // Get report snapshots
  const { data: reports } = await supabase
    .from("report_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("period_end", { ascending: false })
    .limit(12);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          Weekly and monthly cost summaries, generated automatically.
        </p>
      </div>

      {(reports ?? []).length > 0 ? (
        <div className="space-y-4">
          {(reports ?? []).map((report) => {
            const data = report.report_data as {
              total_cost_cents: number;
              cost_change_pct: number;
              top_models: Array<{
                model: string;
                total_cost_cents: number;
              }>;
              top_features: Array<{
                feature_tag: string;
                total_cost_cents: number;
              }>;
              recommendations: Array<{
                title: string;
                estimated_savings_cents: number;
              }>;
              anomalies: Array<{ id: string }>;
            };

            return (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">
                          Week of {report.period_start} to {report.period_end}
                        </CardTitle>
                        <div className="mt-0.5 text-sm text-muted-foreground">
                          Generated {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatCost(data.total_cost_cents)}
                        </div>
                        <div
                          className={`flex items-center justify-end text-xs ${
                            data.cost_change_pct >= 0
                              ? "text-destructive"
                              : "text-success"
                          }`}
                        >
                          {data.cost_change_pct >= 0 ? (
                            <TrendingUp className="mr-1 h-3 w-3" />
                          ) : (
                            <TrendingDown className="mr-1 h-3 w-3" />
                          )}
                          {Math.abs(data.cost_change_pct).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Top Models */}
                    <div>
                      <div className="mb-2 text-sm font-medium text-muted-foreground">
                        Top Models
                      </div>
                      <div className="space-y-2">
                        {(data.top_models ?? []).slice(0, 3).map((m) => (
                          <div
                            key={m.model}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-foreground">{m.model}</span>
                            <span className="font-medium">
                              {formatCost(m.total_cost_cents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Features */}
                    <div>
                      <div className="mb-2 text-sm font-medium text-muted-foreground">
                        Top Features
                      </div>
                      <div className="space-y-2">
                        {(data.top_features ?? []).slice(0, 3).map((f) => (
                          <div
                            key={f.feature_tag}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-foreground">
                              {f.feature_tag}
                            </span>
                            <span className="font-medium">
                              {formatCost(f.total_cost_cents)}
                            </span>
                          </div>
                        ))}
                        {(data.top_features ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            No feature tags
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Highlights */}
                    <div>
                      <div className="mb-2 text-sm font-medium text-muted-foreground">
                        Highlights
                      </div>
                      <div className="space-y-2 text-sm">
                        {(data.anomalies ?? []).length > 0 && (
                          <Badge variant="warning">
                            {data.anomalies.length} anomal
                            {data.anomalies.length === 1 ? "y" : "ies"}
                          </Badge>
                        )}
                        {(data.recommendations ?? []).length > 0 && (
                          <div className="text-success">
                            {data.recommendations.length} optimization
                            {data.recommendations.length === 1 ? "" : "s"}{" "}
                            available
                          </div>
                        )}
                        {(data.anomalies ?? []).length === 0 &&
                          (data.recommendations ?? []).length === 0 && (
                            <span className="text-muted-foreground">
                              No notable events
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="mx-auto h-10 w-10 mb-4 opacity-50" />
              <p className="text-lg font-medium">No reports yet</p>
              <p className="text-sm mt-2">
                Weekly reports are generated automatically every Monday. Check
                back after your first week of usage data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
