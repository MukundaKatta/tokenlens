import type { UsageRecord } from "@tokenlens/shared";

interface BedrockCredentials {
  access_key_id: string;
  secret_access_key: string;
  region: string;
}

/**
 * Fetch AWS Bedrock usage via CloudWatch metrics.
 * In production, you'd use the AWS SDK. This implementation uses direct API calls.
 */
export async function fetchBedrockUsage(
  credentials: BedrockCredentials,
  startDate: Date,
  endDate?: Date
): Promise<Omit<UsageRecord, "id" | "workspace_id">[]> {
  const { access_key_id, secret_access_key, region } = credentials;
  const end = endDate ?? new Date();

  // Use AWS Cost Explorer API for accurate billing data
  const host = `ce.${region}.amazonaws.com`;
  const body = JSON.stringify({
    TimePeriod: {
      Start: startDate.toISOString().split("T")[0],
      End: end.toISOString().split("T")[0],
    },
    Granularity: "DAILY",
    Filter: {
      Dimensions: {
        Key: "SERVICE",
        Values: ["Amazon Bedrock"],
      },
    },
    GroupBy: [
      { Type: "DIMENSION", Key: "USAGE_TYPE" },
    ],
    Metrics: ["UnblendedCost", "UsageQuantity"],
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  // AWS SigV4 signing
  const encoder = new TextEncoder();

  async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  }

  async function hash(data: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  const payloadHash = await hash(body);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:AWSInsightsIndexService.GetCostAndUsage\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/ce/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await hash(canonicalRequest)}`;

  const kDate = await hmac(encoder.encode("AWS4" + secret_access_key).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "ce");
  const kSigning = await hmac(kService, "aws4_request");

  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey("raw", kSigning, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      encoder.encode(stringToSign)
    )
  );
  const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${access_key_id}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage",
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`AWS Cost Explorer error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const records: Omit<UsageRecord, "id" | "workspace_id">[] = [];

  for (const result of data.ResultsByTime ?? []) {
    for (const group of result.Groups ?? []) {
      const usageType = group.Keys?.[0] ?? "unknown";
      const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? "0");
      const costCents = Math.round(cost * 100);

      // Parse model from usage type (e.g., "USE1-Bedrock:Claude-v3-Sonnet")
      const modelMatch = usageType.match(/Bedrock[:-](.+)/);
      const model = modelMatch ? modelMatch[1] : usageType;

      if (costCents > 0) {
        records.push({
          provider: "aws_bedrock",
          model,
          input_tokens: 0, // Cost Explorer doesn't provide token counts
          output_tokens: 0,
          total_cost_cents: costCents,
          feature_tag: null,
          user_tag: null,
          team_tag: null,
          environment: "production",
          latency_ms: null,
          request_id: null,
          recorded_at: result.TimePeriod?.Start ?? new Date().toISOString(),
        });
      }
    }
  }

  return records;
}

/**
 * Validate AWS credentials by calling STS GetCallerIdentity.
 */
export async function validateAWSCredentials(
  credentials: BedrockCredentials
): Promise<boolean> {
  try {
    const { access_key_id, secret_access_key, region } = credentials;
    const host = `sts.${region}.amazonaws.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const response = await fetch(
      `https://${host}/?Action=GetCallerIdentity&Version=2011-06-15`,
      {
        headers: {
          Host: host,
          "X-Amz-Date": amzDate,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
