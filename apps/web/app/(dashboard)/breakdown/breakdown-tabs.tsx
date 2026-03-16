"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageTable } from "@/components/tables/usage-table";
import { CostBreakdownChart } from "@/components/charts/cost-breakdown-chart";
import { formatCost, formatNumber } from "@tokenlens/shared";

interface TagCost {
  tag: string;
  total_cost_cents: number;
  request_count: number;
}

interface ModelCost {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_cents: number;
  request_count: number;
}

interface BreakdownTabsProps {
  modelData: ModelCost[];
  featureData: TagCost[];
  teamData: TagCost[];
  userData: TagCost[];
  envData: TagCost[];
}

function TagBreakdown({ data, label }: { data: TagCost[]; label: string }) {
  const total = data.reduce((sum, d) => sum + d.total_cost_cents, 0);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No {label.toLowerCase()} data available. Use the SDK to tag your LLM calls.
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((d) => ({
    name: d.tag,
    value: d.total_cost_cents,
    percentage: total > 0 ? (d.total_cost_cents / total) * 100 : 0,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{label} Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <CostBreakdownChart data={chartData} height={300} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{label} Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((item) => (
              <div
                key={item.tag}
                className="flex items-center justify-between rounded-lg border border-border/50 p-3"
              >
                <div>
                  <div className="font-medium text-foreground">{item.tag}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(item.request_count)} requests
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">
                    {formatCost(item.total_cost_cents)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {total > 0
                      ? ((item.total_cost_cents / total) * 100).toFixed(1)
                      : "0"}
                    %
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BreakdownTabs({
  modelData,
  featureData,
  teamData,
  userData,
  envData,
}: BreakdownTabsProps) {
  return (
    <Tabs defaultValue="model" className="space-y-6">
      <TabsList>
        <TabsTrigger value="model">By Model</TabsTrigger>
        <TabsTrigger value="feature">By Feature</TabsTrigger>
        <TabsTrigger value="team">By Team</TabsTrigger>
        <TabsTrigger value="user">By User</TabsTrigger>
        <TabsTrigger value="environment">By Environment</TabsTrigger>
      </TabsList>

      <TabsContent value="model">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageTable data={modelData} showLatency />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="feature">
        <TagBreakdown data={featureData} label="Feature" />
      </TabsContent>

      <TabsContent value="team">
        <TagBreakdown data={teamData} label="Team" />
      </TabsContent>

      <TabsContent value="user">
        <TagBreakdown data={userData} label="User" />
      </TabsContent>

      <TabsContent value="environment">
        <TagBreakdown data={envData} label="Environment" />
      </TabsContent>
    </Tabs>
  );
}
