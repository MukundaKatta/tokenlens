export interface TokenLensConfig {
  /** Your TokenLens API key (starts with tl_) */
  apiKey: string;
  /** TokenLens ingestion endpoint. Defaults to https://app.tokenlens.dev/api/ingest */
  endpoint?: string;
  /** How many events to buffer before flushing. Default: 50 */
  batchSize?: number;
  /** Max time in ms to buffer events before flushing. Default: 5000 */
  flushInterval?: number;
  /** Default tags applied to all events */
  defaultTags?: {
    feature?: string;
    user?: string;
    team?: string;
    environment?: string;
  };
  /** Enable debug logging. Default: false */
  debug?: boolean;
  /** Custom fetch implementation (for testing or edge runtimes) */
  fetchFn?: typeof fetch;
}

export interface UsageEvent {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_cents?: number;
  feature_tag?: string;
  user_tag?: string;
  team_tag?: string;
  environment?: string;
  latency_ms?: number;
  request_id?: string;
  recorded_at?: string;
}

export interface FlushResult {
  success: boolean;
  accepted: number;
  errors: string[];
}

export class TokenLens {
  private config: Required<
    Pick<TokenLensConfig, "apiKey" | "endpoint" | "batchSize" | "flushInterval" | "debug">
  > & { defaultTags: NonNullable<TokenLensConfig["defaultTags"]>; fetchFn: typeof fetch };

  private buffer: UsageEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(config: TokenLensConfig) {
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint ?? "https://app.tokenlens.dev/api/ingest",
      batchSize: config.batchSize ?? 50,
      flushInterval: config.flushInterval ?? 5000,
      debug: config.debug ?? false,
      defaultTags: config.defaultTags ?? {},
      fetchFn: config.fetchFn ?? globalThis.fetch.bind(globalThis),
    };

    this.startFlushTimer();
  }

  /**
   * Track a single LLM usage event.
   */
  track(event: UsageEvent): void {
    const enriched: UsageEvent = {
      ...event,
      feature_tag: event.feature_tag ?? this.config.defaultTags.feature,
      user_tag: event.user_tag ?? this.config.defaultTags.user,
      team_tag: event.team_tag ?? this.config.defaultTags.team,
      environment: event.environment ?? this.config.defaultTags.environment ?? "production",
      recorded_at: event.recorded_at ?? new Date().toISOString(),
    };

    this.buffer.push(enriched);
    this.log(`Tracked event: ${enriched.provider}/${enriched.model} (${enriched.input_tokens}+${enriched.output_tokens} tokens)`);

    if (this.buffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  /**
   * Flush all buffered events to the TokenLens API.
   */
  async flush(): Promise<FlushResult> {
    if (this.flushing || this.buffer.length === 0) {
      return { success: true, accepted: 0, errors: [] };
    }

    this.flushing = true;
    const events = [...this.buffer];
    this.buffer = [];

    try {
      const response = await this.config.fetchFn(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.log(`Flush failed: ${response.status} ${errorText}`);
        // Put events back in buffer for retry
        this.buffer.unshift(...events);
        return { success: false, accepted: 0, errors: [errorText] };
      }

      const result = await response.json();
      this.log(`Flushed ${events.length} events successfully`);
      return { success: true, accepted: result.accepted ?? events.length, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.log(`Flush error: ${message}`);
      // Put events back in buffer for retry
      this.buffer.unshift(...events);
      return { success: false, accepted: 0, errors: [message] };
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Shut down the client, flushing any remaining events.
   */
  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  /**
   * Get the number of buffered events.
   */
  get pendingEvents(): number {
    return this.buffer.length;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flushInterval);

    // Allow Node.js to exit even if timer is running
    if (typeof this.flushTimer === "object" && "unref" in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[TokenLens] ${message}`);
    }
  }
}
