"use client";

import { formatCost, formatNumber } from "@tokenlens/shared";
import { PROVIDER_DISPLAY_NAMES } from "@tokenlens/shared";
import { Badge } from "@/components/ui/badge";

interface UsageRow {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_cents: number;
  request_count: number;
  avg_latency_ms?: number;
}

interface UsageTableProps {
  data: UsageRow[];
  showLatency?: boolean;
}

export function UsageTable({ data, showLatency = false }: UsageTableProps) {
  const sortedData = [...data].sort(
    (a, b) => b.total_cost_cents - a.total_cost_cents
  );
  const totalCost = data.reduce((sum, r) => sum + r.total_cost_cents, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Provider
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Model
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Requests
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Input Tokens
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Output Tokens
            </th>
            {showLatency && (
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Avg Latency
              </th>
            )}
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Cost
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              % of Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => {
            const pct = totalCost > 0 ? (row.total_cost_cents / totalCost) * 100 : 0;
            return (
              <tr
                key={`${row.provider}-${row.model}-${i}`}
                className="border-b border-border/50 hover:bg-accent/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {PROVIDER_DISPLAY_NAMES[row.provider] ?? row.provider}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {row.model}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {formatNumber(row.request_count)}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {formatNumber(row.input_tokens)}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {formatNumber(row.output_tokens)}
                </td>
                {showLatency && (
                  <td className="px-4 py-3 text-right text-foreground">
                    {row.avg_latency_ms ? `${row.avg_latency_ms}ms` : "-"}
                  </td>
                )}
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCost(row.total_cost_cents)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="min-w-[3rem] text-right text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-semibold">
            <td colSpan={showLatency ? 6 : 5} className="px-4 py-3 text-foreground">
              Total
            </td>
            <td className="px-4 py-3 text-right text-foreground">
              {formatCost(totalCost)}
            </td>
            <td className="px-4 py-3 text-right text-muted-foreground">
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
