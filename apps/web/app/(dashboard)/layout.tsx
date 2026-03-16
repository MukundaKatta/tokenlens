import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name, slug, plan)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const workspace = membership?.workspaces as {
    id: string;
    name: string;
    slug: string;
    plan: string;
  } | null;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardNav
        user={{ id: user.id, email: user.email ?? "" }}
        workspace={workspace ?? { id: "", name: "My Workspace", slug: "default", plan: "free" }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
