"use client";

import { MODEL_PRICING, PROVIDER_DISPLAY_NAMES } from "@tokenlens/shared";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@tokenlens/shared";

interface ModelPricingTableProps {
  filterProvider?: string;
}

export function ModelPricingTable({ filterProvider }: ModelPricingTableProps) {
  const models = filterProvider
    ? MODEL_PRICING.filter((m) => m.provider === filterProvider)
    : MODEL_PRICING;

  const sorted = [...models].sort(
    (a, b) =>
      a.input_cost_per_million +
      a.output_cost_per_million -
      (b.input_cost_per_million + b.output_cost_per_million)
  );

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
              Input $/1M tokens
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Output $/1M tokens
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Context Window
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((model) => (
            <tr
              key={`${model.provider}-${model.model}`}
              className="border-b border-border/50 hover:bg-accent/50 transition-colors"
            >
              <td className="px-4 py-3">
                <Badge variant="secondary">
                  {PROVIDER_DISPLAY_NAMES[model.provider] ?? model.provider}
                </Badge>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {model.model}
              </td>
              <td className="px-4 py-3 text-right text-foreground">
                ${(model.input_cost_per_million / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-foreground">
                ${(model.output_cost_per_million / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-foreground">
                {formatNumber(model.context_window)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
