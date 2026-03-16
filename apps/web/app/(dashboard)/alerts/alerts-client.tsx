"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCard } from "@/components/alerts/alert-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { formatCost } from "@tokenlens/shared";
import type { BudgetAlert, AnomalyEvent } from "@tokenlens/shared";
import { Plus, AlertTriangle, CheckCircle } from "lucide-react";

interface AlertsClientProps {
  alertsWithSpend: Array<{
    alert: BudgetAlert;
    currentSpendCents: number;
  }>;
  anomalies: AnomalyEvent[];
  workspaceId: string;
}

export function AlertsClient({
  alertsWithSpend,
  anomalies,
  workspaceId,
}: AlertsClientProps) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    name: "",
    threshold: "",
    period: "monthly",
    notifyEmail: "",
    notifySlack: "",
  });

  async function handleCreateAlert() {
    const supabase = createClient();
    const channels: string[] = [];
    if (newAlert.notifyEmail) channels.push(newAlert.notifyEmail);
    if (newAlert.notifySlack) channels.push(newAlert.notifySlack);

    await supabase.from("budget_alerts").insert({
      workspace_id: workspaceId,
      name: newAlert.name,
      threshold_cents: Math.round(parseFloat(newAlert.threshold) * 100),
      period: newAlert.period,
      notify_channels: channels,
    });

    setShowCreateForm(false);
    setNewAlert({ name: "", threshold: "", period: "monthly", notifyEmail: "", notifySlack: "" });
    router.refresh();
  }

  async function handleDeleteAlert(id: string) {
    const supabase = createClient();
    await supabase.from("budget_alerts").delete().eq("id", id);
    router.refresh();
  }

  async function handleAcknowledgeAnomaly(id: string) {
    const supabase = createClient();
    await supabase
      .from("anomaly_events")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    router.refresh();
  }

  return (
    <Tabs defaultValue="budgets" className="space-y-6">
      <TabsList>
        <TabsTrigger value="budgets">Budget Alerts</TabsTrigger>
        <TabsTrigger value="anomalies">
          Anomalies
          {anomalies.filter((a) => !a.acknowledged).length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {anomalies.filter((a) => !a.acknowledged).length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="budgets" className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Alert
          </Button>
        </div>

        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Budget Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Alert Name
                  </label>
                  <input
                    type="text"
                    value={newAlert.name}
                    onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="Monthly budget limit"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Threshold ($)
                  </label>
                  <input
                    type="number"
                    value={newAlert.threshold}
                    onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="500.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Period
                  </label>
                  <select
                    value={newAlert.period}
                    onChange={(e) => setNewAlert({ ...newAlert, period: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Notify Email
                  </label>
                  <input
                    type="email"
                    value={newAlert.notifyEmail}
                    onChange={(e) => setNewAlert({ ...newAlert, notifyEmail: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="team@company.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground">
                    Slack Webhook URL (optional)
                  </label>
                  <input
                    type="url"
                    value={newAlert.notifySlack}
                    onChange={(e) => setNewAlert({ ...newAlert, notifySlack: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button onClick={handleCreateAlert} disabled={!newAlert.name || !newAlert.threshold}>
                    Create Alert
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {alertsWithSpend.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {alertsWithSpend.map(({ alert, currentSpendCents }) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                currentSpendCents={currentSpendCents}
                onDelete={handleDeleteAlert}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex h-48 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>No budget alerts configured yet.</p>
                <p className="text-sm">Create one to get notified when spend exceeds your threshold.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="anomalies" className="space-y-4">
        {anomalies.length > 0 ? (
          anomalies.map((anomaly) => (
            <Card
              key={anomaly.id}
              className={
                anomaly.acknowledged
                  ? "opacity-60"
                  : anomaly.severity === "critical"
                    ? "border-destructive/50"
                    : anomaly.severity === "high"
                      ? "border-warning/50"
                      : ""
              }
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-start gap-3">
                  {anomaly.acknowledged ? (
                    <CheckCircle className="mt-0.5 h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle
                      className={`mt-0.5 h-5 w-5 ${
                        anomaly.severity === "critical"
                          ? "text-destructive"
                          : anomaly.severity === "high"
                            ? "text-warning"
                            : "text-muted-foreground"
                      }`}
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {anomaly.metric.replace(/_/g, " ")}
                      </span>
                      <Badge
                        variant={
                          anomaly.severity === "critical" || anomaly.severity === "high"
                            ? "destructive"
                            : anomaly.severity === "medium"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {anomaly.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {anomaly.description}
                    </p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Expected: {formatCost(anomaly.expected_value)} | Actual:{" "}
                      {formatCost(anomaly.actual_value)} | Detected:{" "}
                      {new Date(anomaly.detected_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {!anomaly.acknowledged && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAcknowledgeAnomaly(anomaly.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex h-48 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>No anomalies detected.</p>
                <p className="text-sm">The system checks for cost spikes daily.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
