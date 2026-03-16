"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CostTrend } from "@tokenlens/shared";
import { formatCost } from "@tokenlens/shared";

interface CostTrendChartProps {
  data: CostTrend[];
  height?: number;
  showForecast?: boolean;
  forecastData?: Array<{
    date: string;
    projected_cost_cents: number;
    lower_bound_cents: number;
    upper_bound_cents: number;
  }>;
}

export function CostTrendChart({
  data,
  height = 350,
  showForecast = false,
  forecastData = [],
}: CostTrendChartProps) {
  const chartData = [
    ...data.map((d) => ({
      date: d.date,
      cost: d.total_cost_cents,
      type: "actual" as const,
    })),
    ...(showForecast
      ? forecastData.map((d) => ({
          date: d.date,
          cost: d.projected_cost_cents,
          lower: d.lower_bound_cents,
          upper: d.upper_bound_cents,
          type: "forecast" as const,
        }))
      : []),
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          stroke="var(--color-muted-foreground)"
          fontSize={12}
          tickFormatter={(value: string) => {
            const date = new Date(value);
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          }}
        />
        <YAxis
          stroke="var(--color-muted-foreground)"
          fontSize={12}
          tickFormatter={(value: number) => formatCost(value)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            color: "var(--color-foreground)",
          }}
          formatter={(value: number) => [formatCost(value), "Cost"]}
          labelFormatter={(label: string) =>
            new Date(label).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          }
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="var(--color-chart-1)"
          fillOpacity={1}
          fill="url(#costGradient)"
          strokeWidth={2}
        />
        {showForecast && (
          <>
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fillOpacity={0.1}
              fill="var(--color-chart-2)"
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fillOpacity={0.1}
              fill="var(--color-chart-2)"
            />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
