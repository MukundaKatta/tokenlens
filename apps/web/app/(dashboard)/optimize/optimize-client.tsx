"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCost } from "@tokenlens/shared";
import type { OptimizationRecommendation } from "@tokenlens/shared";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Lightbulb, Zap } from "lucide-react";

interface OptimizeClientProps {
  recommendations: OptimizationRecommendation[];
  workspaceId: string;
}

export function OptimizeClient({
  recommendations,
  workspaceId,
}: OptimizeClientProps) {
  const router = useRouter();

  async function handleApplyRecommendation(rec: OptimizationRecommendation) {
    const supabase = createClient();

    await supabase.from("optimization_rules").insert({
      workspace_id: workspaceId,
      name: rec.title,
      condition: {
        source_model: rec.source_model,
      },
      route_to_model: rec.target_model,
      estimated_savings_pct: rec.estimated_savings_pct,
      active: false,
    });

    router.refresh();
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.7) return "text-success";
    if (confidence >= 0.5) return "text-warning";
    return "text-muted-foreground";
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Lightbulb className="mx-auto h-10 w-10 mb-4 opacity-50" />
            <p className="text-lg font-medium">No recommendations yet</p>
            <p className="text-sm mt-2">
              We need more usage data to generate optimization suggestions.
              Keep using the platform and check back later.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <Card key={rec.id}>
          <CardContent className="py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{rec.title}</h3>
                </div>

                <p className="text-sm text-muted-foreground pl-8">
                  {rec.description}
                </p>

                <div className="flex items-center gap-4 pl-8">
                  {rec.source_model !== rec.target_model && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{rec.source_model}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline">{rec.target_model}</Badge>
                    </div>
                  )}

                  <span className={`text-sm font-medium ${getConfidenceColor(rec.confidence)}`}>
                    {Math.round(rec.confidence * 100)}% confidence
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-success">
                    Save {formatCost(rec.estimated_savings_cents)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ~{rec.estimated_savings_pct}% reduction
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyRecommendation(rec)}
                >
                  Create Rule
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
