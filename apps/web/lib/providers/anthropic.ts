import { calculateCostCents } from "@tokenlens/shared";
import type { UsageRecord } from "@tokenlens/shared";

interface AnthropicUsageEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: string;
  request_id?: string;
}

interface AnthropicUsageResponse {
  data: AnthropicUsageEntry[];
  has_more: boolean;
  next_cursor?: string;
}

export async function fetchAnthropicUsage(
  apiKey: string,
  startDate: Date,
  endDate?: Date
): Promise<Omit<UsageRecord, "id" | "workspace_id">[]> {
  const records: Omit<UsageRecord, "id" | "workspace_id">[] = [];
  const startTime = startDate.toISOString();
  const endTime = (endDate ?? new Date()).toISOString();

  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      start_time: startTime,
      end_time: endTime,
      ...(cursor ? { cursor } : {}),
    });

    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/usage?${params}`,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2024-01-01",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const data: AnthropicUsageResponse = await response.json();

    for (const entry of data.data) {
      const costCents = calculateCostCents(
        "anthropic",
        entry.model,
        entry.input_tokens,
        entry.output_tokens
      );

      records.push({
        provider: "anthropic",
        model: entry.model,
        input_tokens: entry.input_tokens,
        output_tokens: entry.output_tokens,
        total_cost_cents: costCents,
        feature_tag: null,
        user_tag: null,
        team_tag: null,
        environment: "production",
        latency_ms: null,
        request_id: entry.request_id ?? null,
        recorded_at: entry.timestamp,
      });
    }

    hasMore = data.has_more;
    cursor = data.next_cursor ?? null;
  }

  return records;
}

/**
 * Validate an Anthropic API key.
 */
export async function validateAnthropicKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2024-01-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    // Even a 400 means the key is valid (just bad request)
    return response.status !== 401 && response.status !== 403;
  } catch {
    return false;
  }
}
