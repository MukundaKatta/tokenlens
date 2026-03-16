"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { PROVIDER_DISPLAY_NAMES } from "@tokenlens/shared";
import { Plus, Key, Link2, Users, Settings2, Trash2 } from "lucide-react";

interface Connection {
  id: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface SettingsClientProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    stripe_customer_id: string | null;
  };
  connections: Connection[];
  apiKeys: ApiKey[];
  members: Member[];
  userRole: string;
  workspaceId: string;
}

export function SettingsClient({
  workspace,
  connections,
  apiKeys,
  members,
  userRole,
  workspaceId,
}: SettingsClientProps) {
  const router = useRouter();
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newProvider, setNewProvider] = useState({ provider: "openai", apiKey: "" });
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const isAdmin = userRole === "owner" || userRole === "admin";

  async function handleAddProvider() {
    const supabase = createClient();

    // In production, the API key would be encrypted server-side
    // For now, store it directly (the encryption happens via server action)
    const response = await fetch("/api/settings/connect-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        provider: newProvider.provider,
        api_key: newProvider.apiKey,
      }),
    });

    if (response.ok) {
      setShowAddProvider(false);
      setNewProvider({ provider: "openai", apiKey: "" });
      router.refresh();
    }
  }

  async function handleDeleteConnection(id: string) {
    const supabase = createClient();
    await supabase.from("provider_connections").delete().eq("id", id);
    router.refresh();
  }

  async function handleCreateApiKey() {
    // Generate a random API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const rawKey = `tl_${Array.from(keyBytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const prefix = rawKey.slice(0, 10) + "...";

    // Hash the key for storage
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawKey)
    );
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const supabase = createClient();
    await supabase.from("api_keys").insert({
      workspace_id: workspaceId,
      name: newKeyName,
      key_hash: keyHash,
      key_prefix: prefix,
    });

    setCreatedKey(rawKey);
    setShowCreateKey(false);
    setNewKeyName("");
    router.refresh();
  }

  async function handleDeleteApiKey(id: string) {
    const supabase = createClient();
    await supabase.from("api_keys").delete().eq("id", id);
    router.refresh();
  }

  return (
    <Tabs defaultValue="providers" className="space-y-6">
      <TabsList>
        <TabsTrigger value="providers">
          <Link2 className="mr-2 h-4 w-4" />
          Providers
        </TabsTrigger>
        <TabsTrigger value="apikeys">
          <Key className="mr-2 h-4 w-4" />
          API Keys
        </TabsTrigger>
        <TabsTrigger value="team">
          <Users className="mr-2 h-4 w-4" />
          Team
        </TabsTrigger>
        <TabsTrigger value="workspace">
          <Settings2 className="mr-2 h-4 w-4" />
          Workspace
        </TabsTrigger>
      </TabsList>

      {/* Providers Tab */}
      <TabsContent value="providers" className="space-y-4">
        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => setShowAddProvider(!showAddProvider)}>
              <Plus className="mr-2 h-4 w-4" />
              Connect Provider
            </Button>
          </div>
        )}

        {showAddProvider && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Provider</CardTitle>
              <CardDescription>
                Add your API key to automatically sync usage data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Provider</label>
                <select
                  value={newProvider.provider}
                  onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="aws_bedrock">AWS Bedrock</option>
                  <option value="google_vertex">Google Vertex AI</option>
                  <option value="azure_openai">Azure OpenAI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">API Key</label>
                <input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                  placeholder="sk-..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddProvider} disabled={!newProvider.apiKey}>
                  Connect
                </Button>
                <Button variant="outline" onClick={() => setShowAddProvider(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {connections.length > 0 ? (
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium text-foreground">
                        {PROVIDER_DISPLAY_NAMES[conn.provider] ?? conn.provider}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {conn.last_synced_at
                          ? `Last synced: ${new Date(conn.last_synced_at).toLocaleString()}`
                          : "Never synced"}
                      </div>
                      {conn.sync_error && (
                        <div className="mt-1 text-xs text-destructive">
                          Error: {conn.sync_error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        conn.status === "active"
                          ? "success"
                          : conn.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {conn.status}
                    </Badge>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteConnection(conn.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
              No providers connected. Add one to start syncing usage data.
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* API Keys Tab */}
      <TabsContent value="apikeys" className="space-y-4">
        {createdKey && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4">
              <div className="text-sm font-medium text-success">API Key Created</div>
              <div className="mt-2 rounded-lg bg-card p-3 font-mono text-sm text-foreground">
                {createdKey}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Copy this key now. It will not be shown again.
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey);
                  setCreatedKey(null);
                }}
              >
                Copy and Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateKey(!showCreateKey)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </div>
        )}

        {showCreateKey && (
          <Card>
            <CardHeader>
              <CardTitle>Create API Key</CardTitle>
              <CardDescription>
                Use this key with the @tokenlens/sdk to ingest usage data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                  placeholder="Production API Key"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateApiKey} disabled={!newKeyName}>
                  Create
                </Button>
                <Button variant="outline" onClick={() => setShowCreateKey(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {apiKeys.length > 0 ? (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="font-medium text-foreground">{key.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{key.key_prefix}</span>
                      {" | "}
                      {key.last_used_at
                        ? `Last used: ${new Date(key.last_used_at).toLocaleDateString()}`
                        : "Never used"}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteApiKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
              No API keys yet. Create one to use the SDK.
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Team Tab */}
      <TabsContent value="team" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                >
                  <div className="text-sm text-foreground">
                    User: {member.user_id.slice(0, 8)}...
                  </div>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Workspace Tab */}
      <TabsContent value="workspace" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Workspace Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Name</div>
                <div className="text-foreground">{workspace.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Slug</div>
                <div className="text-foreground">{workspace.slug}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Plan</div>
                <Badge variant="default" className="capitalize">
                  {workspace.plan}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Billing</div>
                <div className="text-foreground">
                  {workspace.stripe_customer_id
                    ? "Active subscription"
                    : "No payment method"}
                </div>
              </div>
            </div>

            {workspace.plan === "free" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="font-medium text-foreground">Upgrade to Pro</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get unlimited provider connections, 25 budget alerts, and 365-day data retention.
                </p>
                <Button className="mt-3" size="sm">
                  Upgrade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SDK Quick Start</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground">
              <code>{`npm install @tokenlens/sdk

import { TokenLens, wrapOpenAI } from "@tokenlens/sdk";
import OpenAI from "openai";

const tl = new TokenLens({ apiKey: "tl_your_api_key" });
const openai = wrapOpenAI(new OpenAI(), tl, {
  feature: "chatbot",
  team: "product",
});

// All calls are now tracked automatically
const res = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

// Don't forget to flush before process exit
await tl.shutdown();`}</code>
            </pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
