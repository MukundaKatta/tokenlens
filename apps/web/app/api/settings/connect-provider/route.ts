import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptCredentials } from "@/lib/providers/encryption";
import { z } from "zod";

const schema = z.object({
  workspace_id: z.string().uuid(),
  provider: z.enum([
    "openai",
    "anthropic",
    "aws_bedrock",
    "google_vertex",
    "azure_openai",
  ]),
  api_key: z.string().min(1),
  region: z.string().optional(),
  project_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify user has admin access to workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", parsed.data.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build credentials object based on provider
    const credentials: Record<string, string> = { api_key: parsed.data.api_key };
    if (parsed.data.region) credentials.region = parsed.data.region;
    if (parsed.data.project_id) credentials.project_id = parsed.data.project_id;

    // Encrypt credentials
    const encrypted = await encryptCredentials(credentials);

    // Store the connection
    const serviceClient = await createServiceClient();
    const { error } = await serviceClient.from("provider_connections").insert({
      workspace_id: parsed.data.workspace_id,
      provider: parsed.data.provider,
      credentials_encrypted: encrypted,
      status: "active",
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Connect provider error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
