"use client";

import type { BudgetAlert } from "@tokenlens/shared";
import { formatCost } from "@tokenlens/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff } from "lucide-react";

interface AlertCardProps {
  alert: BudgetAlert;
  currentSpendCents: number;
  onToggle?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export function AlertCard({
  alert,
  currentSpendCents,
  onToggle,
  onDelete,
}: AlertCardProps) {
  const percentage = (currentSpendCents / alert.threshold_cents) * 100;
  const isTriggered = currentSpendCents >= alert.threshold_cents;
  const isNearThreshold = percentage >= 80 && !isTriggered;

  return (
    <Card className={isTriggered ? "border-destructive/50" : isNearThreshold ? "border-warning/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{alert.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={isTriggered ? "destructive" : isNearThreshold ? "warning" : "secondary"}
          >
            {isTriggered ? "Triggered" : isNearThreshold ? "Warning" : "Active"}
          </Badge>
          <Badge variant="outline">{alert.period}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {formatCost(currentSpendCents)}
              </div>
              <div className="text-sm text-muted-foreground">
                of {formatCost(alert.threshold_cents)} threshold
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {percentage.toFixed(1)}%
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                isTriggered
                  ? "bg-destructive"
                  : isNearThreshold
                    ? "bg-warning"
                    : "bg-primary"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {alert.notify_channels.map((ch, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {ch.includes("slack.com") ? "Slack" : ch.includes("@") ? "Email" : ch}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {onToggle && (
                <button
                  onClick={() => onToggle(alert.id, !isTriggered)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {isTriggered ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(alert.id)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-xs"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
