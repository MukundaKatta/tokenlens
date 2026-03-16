"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCost, formatNumber } from "@tokenlens/shared";

interface ModelData {
  model: string;
  cost_cents: number;
  requests: number;
  avg_latency_ms: number;
}

interface ModelComparisonChartProps {
  data: ModelData[];
  metric: "cost" | "requests" | "latency";
  height?: number;
}

export function ModelComparisonChart({
  data,
  metric,
  height = 350,
}: ModelComparisonChartProps) {
  const dataKey = metric === "cost" ? "cost_cents" : metric === "requests" ? "requests" : "avg_latency_ms";
  const color = metric === "cost" ? "var(--color-chart-1)" : metric === "requests" ? "var(--color-chart-5)" : "var(--color-chart-6)";

  const formatter = (value: number) => {
    if (metric === "cost") return formatCost(value);
    if (metric === "latency") return `${value}ms`;
    return formatNumber(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          stroke="var(--color-muted-foreground)"
          fontSize={12}
          tickFormatter={formatter}
        />
        <YAxis
          type="category"
          dataKey="model"
          stroke="var(--color-muted-foreground)"
          fontSize={12}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            color: "var(--color-foreground)",
          }}
          formatter={(value: number) => [formatter(value), metric.charAt(0).toUpperCase() + metric.slice(1)]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
