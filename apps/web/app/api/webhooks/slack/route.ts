import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Handle incoming Slack interaction payloads (e.g., acknowledging alerts).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payloadStr = formData.get("payload");

    if (!payloadStr || typeof payloadStr !== "string") {
      return NextResponse.json(
        { error: "Missing payload" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(payloadStr);

    if (payload.type === "block_actions") {
      const action = payload.actions?.[0];

      if (action?.action_id === "acknowledge_anomaly") {
        const anomalyId = action.value;
        const supabase = await createServiceClient();

        await supabase
          .from("anomaly_events")
          .update({
            acknowledged: true,
            acknowledged_at: new Date().toISOString(),
          })
          .eq("id", anomalyId);

        return NextResponse.json({
          response_type: "in_channel",
          text: `Anomaly ${anomalyId} acknowledged.`,
        });
      }

      if (action?.action_id === "snooze_alert") {
        const alertId = action.value;
        const supabase = await createServiceClient();

        // Reset triggered_at to prevent re-triggering for this period
        await supabase
          .from("budget_alerts")
          .update({ triggered_at: new Date().toISOString() })
          .eq("id", alertId);

        return NextResponse.json({
          response_type: "in_channel",
          text: `Alert ${alertId} snoozed until next period.`,
        });
      }
    }

    // Slack URL verification challenge
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
