import type { UsageRecord } from "@tokenlens/shared";

interface VertexCredentials {
  project_id: string;
  service_account_json: string;
}

/**
 * Fetch Google Vertex AI usage from Cloud Monitoring API.
 */
export async function fetchVertexUsage(
  credentials: VertexCredentials,
  startDate: Date,
  endDate?: Date
): Promise<Omit<UsageRecord, "id" | "workspace_id">[]> {
  const { project_id, service_account_json } = credentials;
  const serviceAccount = JSON.parse(service_account_json);
  const end = endDate ?? new Date();

  // Get access token via service account JWT
  const accessToken = await getGoogleAccessToken(serviceAccount);

  // Query Cloud Monitoring for Vertex AI prediction metrics
  const filter = encodeURIComponent(
    `metric.type = "aiplatform.googleapis.com/prediction/online/response_count" AND resource.labels.project_id = "${project_id}"`
  );

  const response = await fetch(
    `https://monitoring.googleapis.com/v3/projects/${project_id}/timeSeries?filter=${filter}&interval.startTime=${startDate.toISOString()}&interval.endTime=${end.toISOString()}&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Monitoring API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const records: Omit<UsageRecord, "id" | "workspace_id">[] = [];

  for (const timeSeries of data.timeSeries ?? []) {
    const model = timeSeries.metric?.labels?.model_id ?? "unknown";
    const location = timeSeries.resource?.labels?.location ?? "unknown";

    for (const point of timeSeries.points ?? []) {
      const requestCount = parseInt(point.value?.int64Value ?? "0", 10);

      // Estimate tokens based on average request size
      // Vertex AI doesn't directly expose token counts in monitoring
      const estimatedInputTokens = requestCount * 500;
      const estimatedOutputTokens = requestCount * 200;

      const costCents = estimateVertexCost(
        model,
        estimatedInputTokens,
        estimatedOutputTokens
      );

      records.push({
        provider: "google_vertex",
        model,
        input_tokens: estimatedInputTokens,
        output_tokens: estimatedOutputTokens,
        total_cost_cents: costCents,
        feature_tag: null,
        user_tag: null,
        team_tag: null,
        environment: "production",
        latency_ms: null,
        request_id: null,
        recorded_at: point.interval?.endTime ?? new Date().toISOString(),
      });
    }
  }

  return records;
}

function estimateVertexCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, [number, number]> = {
    "gemini-2.0-flash": [75, 300],
    "gemini-1.5-pro": [1250, 5000],
    "gemini-1.5-flash": [75, 300],
  };
  const [inputRate, outputRate] = pricing[model] ?? [1250, 5000];
  return Math.round(
    (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
  );
}

async function getGoogleAccessToken(
  serviceAccount: { client_email: string; private_key: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/monitoring.read",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import the RSA private key and sign
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const keyBytes = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  const jwt = `${signingInput}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google auth error: ${tokenResponse.status}`);
  }

  const { access_token } = await tokenResponse.json();
  return access_token;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Validate Google Cloud credentials.
 */
export async function validateVertexCredentials(
  credentials: VertexCredentials
): Promise<boolean> {
  try {
    const serviceAccount = JSON.parse(credentials.service_account_json);
    const token = await getGoogleAccessToken(serviceAccount);
    return !!token;
  } catch {
    return false;
  }
}
