import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/login");
  const workspaceId = membership.workspace_id;
  const workspace = membership.workspaces as {
    id: string;
    name: string;
    slug: string;
    plan: string;
    stripe_customer_id: string | null;
  };

  // Get provider connections
  const { data: connections } = await supabase
    .from("provider_connections")
    .select("id, provider, status, last_synced_at, sync_error, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Get API keys
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Get team members
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your workspace, API keys, provider connections, and team.
        </p>
      </div>

      <SettingsClient
        workspace={workspace}
        connections={connections ?? []}
        apiKeys={apiKeys ?? []}
        members={members ?? []}
        userRole={membership.role}
        workspaceId={workspaceId}
      />
    </div>
  );
}
