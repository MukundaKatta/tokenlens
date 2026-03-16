import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const encryptionKey = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ProviderConnection {
  id: string;
  workspace_id: string;
  provider: string;
  credentials_encrypted: string;
  last_synced_at: string | null;
}

async function decryptCredentials(encrypted: string): Promise<Record<string, string>> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey.slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const data = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function syncOpenAI(
  credentials: Record<string, string>,
  workspaceId: string,
  since: string | null
): Promise<number> {
  const apiKey = credentials.api_key;
  const startDate = since
    ? new Date(since).toISOString().split("T")[0]
    : new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const response = await fetch(
    `https://api.openai.com/v1/organization/usage?start_date=${startDate}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const records: Array<Record<string, unknown>> = [];

  for (const bucket of data.data ?? []) {
    for (const result of bucket.results ?? []) {
      const inputTokens = result.input_tokens ?? 0;
      const outputTokens = result.output_tokens ?? 0;
      const model = result.model ?? "unknown";
      const costCents = calculateOpenAICost(model, inputTokens, outputTokens);

      records.push({
        workspace_id: workspaceId,
        provider: "openai",
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_cost_cents: costCents,
        recorded_at: new Date(bucket.start_time * 1000).toISOString(),
      });
    }
  }

  if (records.length > 0) {
    const { error } = await supabase.from("usage_records").insert(records);
    if (error) throw new Error(`Failed to insert OpenAI records: ${error.message}`);
  }

  return records.length;
}

function calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, [number, number]> = {
    "gpt-4o": [2500, 10000],
    "gpt-4o-mini": [150, 600],
    "gpt-4-turbo": [10000, 30000],
    "gpt-4": [30000, 60000],
    "gpt-3.5-turbo": [500, 1500],
    "o1": [15000, 60000],
    "o1-mini": [3000, 12000],
    "o3-mini": [1100, 4400],
  };
  const [inputRate, outputRate] = pricing[model] ?? [5000, 15000];
  return Math.round((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000);
}

async function syncAnthropic(
  credentials: Record<string, string>,
  workspaceId: string,
  since: string | null
): Promise<number> {
  const apiKey = credentials.api_key;
  const startDate = since ?? new Date(Date.now() - 7 * 86400000).toISOString();

  const response = await fetch(
    `https://api.anthropic.com/v1/organizations/usage?start_time=${startDate}`,
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2024-01-01",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const records: Array<Record<string, unknown>> = [];

  for (const entry of data.data ?? []) {
    const model = entry.model ?? "unknown";
    const inputTokens = entry.input_tokens ?? 0;
    const outputTokens = entry.output_tokens ?? 0;
    const costCents = calculateAnthropicCost(model, inputTokens, outputTokens);

    records.push({
      workspace_id: workspaceId,
      provider: "anthropic",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_cost_cents: costCents,
      recorded_at: entry.timestamp ?? new Date().toISOString(),
    });
  }

  if (records.length > 0) {
    const { error } = await supabase.from("usage_records").insert(records);
    if (error) throw new Error(`Failed to insert Anthropic records: ${error.message}`);
  }

  return records.length;
}

function calculateAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, [number, number]> = {
    "claude-sonnet-4-20250514": [3000, 15000],
    "claude-3-5-haiku-20241022": [800, 4000],
    "claude-3-opus-20240229": [15000, 75000],
    "claude-3-haiku-20240307": [250, 1250],
  };
  const [inputRate, outputRate] = pricing[model] ?? [3000, 15000];
  return Math.round((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000);
}

async function syncAWSBedrock(
  credentials: Record<string, string>,
  workspaceId: string,
  since: string | null
): Promise<number> {
  const { access_key_id, secret_access_key, region } = credentials;
  const startDate = since ?? new Date(Date.now() - 7 * 86400000).toISOString();

  // AWS Bedrock usage is pulled via CloudWatch metrics
  // We use the GetMetricData API to get invocation counts and token usage
  const endTime = new Date().toISOString();
  const body = JSON.stringify({
    MetricDataQueries: [
      {
        Id: "invocations",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Bedrock",
            MetricName: "Invocations",
            Dimensions: [],
          },
          Period: 86400,
          Stat: "Sum",
        },
        ReturnData: true,
      },
      {
        Id: "input_tokens",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Bedrock",
            MetricName: "InputTokenCount",
            Dimensions: [],
          },
          Period: 86400,
          Stat: "Sum",
        },
        ReturnData: true,
      },
      {
        Id: "output_tokens",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Bedrock",
            MetricName: "OutputTokenCount",
            Dimensions: [],
          },
          Period: 86400,
          Stat: "Sum",
        },
        ReturnData: true,
      },
    ],
    StartTime: startDate,
    EndTime: endTime,
  });

  // Sign and send the AWS request
  const awsRegion = region ?? "us-east-1";
  const host = `monitoring.${awsRegion}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  // Simplified AWS SigV4 — in production, use a proper signing library
  const encoder = new TextEncoder();

  async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  }

  async function getSignatureKey(key: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
    const kDate = await hmac(encoder.encode("AWS4" + key).buffer, date);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    return hmac(kService, "aws4_request");
  }

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:GraniteServiceVersion20100801.GetMetricData\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

  const payloadHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(body)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${awsRegion}/monitoring/aws4_request`;

  const canonicalRequestHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;
  const signingKey = await getSignatureKey(secret_access_key, dateStamp, awsRegion, "monitoring");
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC",
      await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      encoder.encode(stringToSign)
    )
  );
  const signature = Array.from(signatureBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${access_key_id}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": "GraniteServiceVersion20100801.GetMetricData",
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`AWS CloudWatch error: ${response.status} ${await response.text()}`);
  }

  const metricsData = await response.json();
  const records: Array<Record<string, unknown>> = [];

  const inputResults = metricsData.MetricDataResults?.find((r: { Id: string }) => r.Id === "input_tokens");
  const outputResults = metricsData.MetricDataResults?.find((r: { Id: string }) => r.Id === "output_tokens");

  if (inputResults?.Timestamps) {
    for (let i = 0; i < inputResults.Timestamps.length; i++) {
      const inputTokens = Math.round(inputResults.Values?.[i] ?? 0);
      const outputTokens = Math.round(outputResults?.Values?.[i] ?? 0);

      records.push({
        workspace_id: workspaceId,
        provider: "aws_bedrock",
        model: "bedrock-aggregate",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_cost_cents: Math.round((inputTokens * 3000 + outputTokens * 15000) / 1_000_000),
        recorded_at: new Date(inputResults.Timestamps[i]).toISOString(),
      });
    }
  }

  if (records.length > 0) {
    const { error } = await supabase.from("usage_records").insert(records);
    if (error) throw new Error(`Failed to insert Bedrock records: ${error.message}`);
  }

  return records.length;
}

async function syncGoogleVertex(
  credentials: Record<string, string>,
  workspaceId: string,
  since: string | null
): Promise<number> {
  const { project_id, service_account_json } = credentials;
  const startDate = since ?? new Date(Date.now() - 7 * 86400000).toISOString();

  // Use Google Cloud Monitoring API to pull Vertex AI metrics
  const serviceAccount = JSON.parse(service_account_json);

  // Create JWT for authentication
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/monitoring.read",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  // In a real implementation, we'd sign the JWT with the private key
  // For now, use the access token approach
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.signature`,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google auth error: ${tokenResponse.status}`);
  }

  const { access_token } = await tokenResponse.json();

  const filter = encodeURIComponent(
    `metric.type="aiplatform.googleapis.com/prediction/online/token_count" AND resource.labels.project_id="${project_id}"`
  );

  const monitoringResponse = await fetch(
    `https://monitoring.googleapis.com/v3/projects/${project_id}/timeSeries?filter=${filter}&interval.startTime=${startDate}&interval.endTime=${new Date().toISOString()}`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!monitoringResponse.ok) {
    throw new Error(`Google Monitoring error: ${monitoringResponse.status}`);
  }

  const monitoringData = await monitoringResponse.json();
  const records: Array<Record<string, unknown>> = [];

  for (const timeSeries of monitoringData.timeSeries ?? []) {
    const model = timeSeries.metric?.labels?.model_id ?? "unknown";
    for (const point of timeSeries.points ?? []) {
      const tokens = point.value?.int64Value ?? 0;
      records.push({
        workspace_id: workspaceId,
        provider: "google_vertex",
        model,
        input_tokens: Math.round(tokens * 0.6),
        output_tokens: Math.round(tokens * 0.4),
        total_cost_cents: Math.round((tokens * 1250) / 1_000_000),
        recorded_at: point.interval?.endTime ?? new Date().toISOString(),
      });
    }
  }

  if (records.length > 0) {
    const { error } = await supabase.from("usage_records").insert(records);
    if (error) throw new Error(`Failed to insert Vertex records: ${error.message}`);
  }

  return records.length;
}

Deno.serve(async (req) => {
  try {
    // Verify this is called by pg_cron or an admin
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all active provider connections
    const { data: connections, error } = await supabase
      .from("provider_connections")
      .select("*")
      .eq("status", "active");

    if (error) throw error;

    const results: Array<{ provider: string; workspace_id: string; records: number; error?: string }> = [];

    for (const conn of connections as ProviderConnection[]) {
      try {
        const credentials = await decryptCredentials(conn.credentials_encrypted);
        let recordCount = 0;

        switch (conn.provider) {
          case "openai":
            recordCount = await syncOpenAI(credentials, conn.workspace_id, conn.last_synced_at);
            break;
          case "anthropic":
            recordCount = await syncAnthropic(credentials, conn.workspace_id, conn.last_synced_at);
            break;
          case "aws_bedrock":
            recordCount = await syncAWSBedrock(credentials, conn.workspace_id, conn.last_synced_at);
            break;
          case "google_vertex":
            recordCount = await syncGoogleVertex(credentials, conn.workspace_id, conn.last_synced_at);
            break;
          default:
            continue;
        }

        // Update last_synced_at
        await supabase
          .from("provider_connections")
          .update({ last_synced_at: new Date().toISOString(), status: "active", sync_error: null })
          .eq("id", conn.id);

        results.push({ provider: conn.provider, workspace_id: conn.workspace_id, records: recordCount });
      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : "Unknown error";
        await supabase
          .from("provider_connections")
          .update({ status: "error", sync_error: errorMessage })
          .eq("id", conn.id);

        results.push({
          provider: conn.provider,
          workspace_id: conn.workspace_id,
          records: 0,
          error: errorMessage,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
