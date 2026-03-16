import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/overview";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user has a workspace, create one if not
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single();

      if (!membership) {
        // Create a default workspace
        const name =
          data.user.user_metadata?.workspace_name ??
          data.user.email?.split("@")[0] ??
          "My Workspace";
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const { data: workspace } = await supabase
          .from("workspaces")
          .insert({ name, slug })
          .select("id")
          .single();

        if (workspace) {
          await supabase.from("workspace_members").insert({
            workspace_id: workspace.id,
            user_id: data.user.id,
            role: "owner",
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // OAuth error - redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
