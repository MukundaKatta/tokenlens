import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateCostCents, MAX_INGEST_BATCH_SIZE } from "@tokenlens/shared";
import type { Provider, IngestPayload } from "@tokenlens/shared";
import { z } from "zod";

const eventSchema = z.object({
  provider: z.enum([
    "openai",
    "anthropic",
    "aws_bedrock",
    "google_vertex",
    "azure_openai",
    "custom",
  ]),
  model: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_cost_cents: z.number().int().optional(),
  feature_tag: z.string().optional(),
  user_tag: z.string().optional(),
  team_tag: z.string().optional(),
  environment: z
    .enum(["production", "staging", "development", "test"])
    .optional(),
  latency_ms: z.number().int().min(0).optional(),
  request_id: z.string().optional(),
  recorded_at: z.string().datetime().optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(MAX_INGEST_BATCH_SIZE),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate via API key
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const supabase = await createServiceClient();

    // Hash the API key and look it up
    const keyHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(apiKey)
    );
    const keyHash = Array.from(new Uint8Array(keyHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: apiKeyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("id, workspace_id, expires_at")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !apiKeyRecord) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Check expiration
    if (
      apiKeyRecord.expires_at &&
      new Date(apiKeyRecord.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "API key has expired" },
        { status: 401 }
      );
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyRecord.id);

    // Parse and validate body
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Transform events to usage records
    const records = parsed.data.events.map((event) => ({
      workspace_id: apiKeyRecord.workspace_id,
      provider: event.provider,
      model: event.model,
      input_tokens: event.input_tokens,
      output_tokens: event.output_tokens,
      total_cost_cents:
        event.total_cost_cents ??
        calculateCostCents(
          event.provider as Provider,
          event.model,
          event.input_tokens,
          event.output_tokens
        ),
      feature_tag: event.feature_tag ?? null,
      user_tag: event.user_tag ?? null,
      team_tag: event.team_tag ?? null,
      environment: event.environment ?? "production",
      latency_ms: event.latency_ms ?? null,
      request_id: event.request_id ?? null,
      recorded_at: event.recorded_at ?? new Date().toISOString(),
    }));

    // Insert in batches
    const { error: insertError } = await supabase
      .from("usage_records")
      .insert(records);

    if (insertError) {
      console.error("Ingest insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to store usage records" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accepted: records.length,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
