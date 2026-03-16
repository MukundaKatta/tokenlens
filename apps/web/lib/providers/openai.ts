import { calculateCostCents } from "@tokenlens/shared";
import type { UsageRecord } from "@tokenlens/shared";

interface OpenAIUsageBucket {
  start_time: number;
  end_time: number;
  results: Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    num_requests: number;
  }>;
}

interface OpenAIUsageResponse {
  data: OpenAIUsageBucket[];
  has_more: boolean;
  next_page?: string;
}

export async function fetchOpenAIUsage(
  apiKey: string,
  startDate: Date,
  endDate?: Date
): Promise<Omit<UsageRecord, "id" | "workspace_id">[]> {
  const records: Omit<UsageRecord, "id" | "workspace_id">[] = [];
  const start = startDate.toISOString().split("T")[0]!;
  const end = (endDate ?? new Date()).toISOString().split("T")[0]!;

  let url: string | null =
    `https://api.openai.com/v1/organization/usage?start_date=${start}&end_date=${end}`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data: OpenAIUsageResponse = await response.json();

    for (const bucket of data.data) {
      for (const result of bucket.results) {
        const costCents = calculateCostCents(
          "openai",
          result.model,
          result.input_tokens,
          result.output_tokens
        );

        records.push({
          provider: "openai",
          model: result.model,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
          total_cost_cents: costCents,
          feature_tag: null,
          user_tag: null,
          team_tag: null,
          environment: "production",
          latency_ms: null,
          request_id: null,
          recorded_at: new Date(bucket.start_time * 1000).toISOString(),
        });
      }
    }

    url = data.has_more && data.next_page ? data.next_page : null;
  }

  return records;
}

/**
 * Validate an OpenAI API key by making a lightweight request.
 */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
