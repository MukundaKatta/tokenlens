"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CostTrendChart } from "@/components/charts/cost-trend-chart";
import { CostBreakdownChart } from "@/components/charts/cost-breakdown-chart";
import type { CostTrend } from "@tokenlens/shared";

interface OverviewChartsProps {
  trendData: CostTrend[];
  breakdownData: Array<{ name: string; value: number; percentage: number }>;
}

export function OverviewCharts({ trendData, breakdownData }: OverviewChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Daily Spend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <CostTrendChart data={trendData} height={300} />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No usage data yet. Connect a provider or integrate the SDK to start tracking.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost by Model</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdownData.length > 0 ? (
            <CostBreakdownChart data={breakdownData} height={300} />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No model data available
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Models</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdownData.length > 0 ? (
            <div className="space-y-4">
              {breakdownData.slice(0, 5).map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-foreground">
                      {item.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="min-w-[60px] text-right text-sm font-semibold text-foreground">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No model data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
