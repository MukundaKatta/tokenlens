"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelComparisonChart } from "@/components/charts/model-comparison-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatNumber } from "@tokenlens/shared";
import type { OptimizationRule } from "@tokenlens/shared";

interface ModelData {
  model: string;
  provider: string;
  cost_cents: number;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  avg_latency_ms: number;
}

interface ModelsClientProps {
  modelData: ModelData[];
  rules: OptimizationRule[];
}

export function ModelsClient({ modelData, rules }: ModelsClientProps) {
  const [metric, setMetric] = useState<"cost" | "requests" | "latency">("cost");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Model Comparison</CardTitle>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
              <TabsList>
                <TabsTrigger value="cost">Cost</TabsTrigger>
                <TabsTrigger value="requests">Requests</TabsTrigger>
                <TabsTrigger value="latency">Latency</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {modelData.length > 0 ? (
            <ModelComparisonChart data={modelData} metric={metric} height={350} />
          ) : (
            <div className="flex h-[350px] items-center justify-center text-muted-foreground">
              No model usage data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Details Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modelData.map((model) => (
          <Card key={`${model.provider}-${model.model}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{model.model}</CardTitle>
                <Badge variant="secondary">{model.provider}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Total Cost</div>
                  <div className="text-lg font-bold">{formatCost(model.cost_cents)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Requests</div>
                  <div className="text-lg font-bold">{formatNumber(model.requests)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Input Tokens</div>
                  <div className="text-sm font-medium">{formatNumber(model.input_tokens)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Output Tokens</div>
                  <div className="text-sm font-medium">{formatNumber(model.output_tokens)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Avg Cost/Request</div>
                  <div className="text-sm font-medium">
                    {model.requests > 0
                      ? formatCost(Math.round(model.cost_cents / model.requests))
                      : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Routing Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Routing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length > 0 ? (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                >
                  <div>
                    <div className="font-medium text-foreground">{rule.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Route to {rule.route_to_model}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rule.estimated_savings_pct && (
                      <Badge variant="success">
                        ~{rule.estimated_savings_pct}% savings
                      </Badge>
                    )}
                    <Badge variant={rule.active ? "default" : "secondary"}>
                      {rule.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No routing rules configured. Visit the Optimize page for AI-generated recommendations.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
