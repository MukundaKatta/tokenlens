"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  PieChart,
  Layers,
  Bell,
  Lightbulb,
  FileText,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

interface DashboardNavProps {
  user: { id: string; email: string };
  workspace: { id: string; name: string; slug: string; plan: string };
}

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/breakdown", label: "Cost Breakdown", icon: PieChart },
  { href: "/models", label: "Models", icon: Layers },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/optimize", label: "Optimize", icon: Lightbulb },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ user, workspace }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-6 py-5">
        <div className="h-8 w-8 rounded-lg bg-primary" />
        <div>
          <div className="text-sm font-bold text-foreground">TokenLens</div>
          <div className="text-xs text-muted-foreground">{workspace.name}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <div className="truncate text-sm text-foreground">{user.email}</div>
            <div className="text-xs capitalize text-muted-foreground">
              {workspace.plan} plan
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
