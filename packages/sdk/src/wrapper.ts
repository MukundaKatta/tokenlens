import { TokenLens } from "./client";
import type { TagContext } from "./tag";

/**
 * Wrap an OpenAI client instance to automatically track usage with TokenLens.
 *
 * @example
 * ```ts
 * import OpenAI from "openai";
 * import { TokenLens, wrapOpenAI } from "@tokenlens/sdk";
 *
 * const tl = new TokenLens({ apiKey: "tl_..." });
 * const openai = wrapOpenAI(new OpenAI(), tl);
 *
 * // All chat completions are now automatically tracked
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
export function wrapOpenAI<T extends Record<string, unknown>>(
  client: T,
  tracker: TokenLens,
  defaultTags?: TagContext
): T {
  const chat = client.chat as Record<string, unknown> | undefined;
  if (!chat?.completions) return client;

  const completions = chat.completions as Record<string, unknown>;
  const originalCreate = completions.create as (...args: unknown[]) => Promise<unknown>;

  completions.create = async function (...args: unknown[]): Promise<unknown> {
    const startTime = Date.now();
    const params = args[0] as Record<string, unknown> | undefined;
    const model = (params?.model as string) ?? "unknown";

    const result = await originalCreate.apply(this, args);

    const latencyMs = Date.now() - startTime;
    const response = result as Record<string, unknown>;
    const usage = response?.usage as Record<string, number> | undefined;

    if (usage) {
      const inputTokens = usage.prompt_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? 0;

      // Extract tags from metadata if present
      const metadata = params?.metadata as Record<string, string> | undefined;
      const tags = {
        feature_tag: metadata?.tokenlens_feature ?? defaultTags?.feature,
        user_tag: metadata?.tokenlens_user ?? defaultTags?.user,
        team_tag: metadata?.tokenlens_team ?? defaultTags?.team,
        environment: metadata?.tokenlens_environment ?? defaultTags?.environment,
      };

      tracker.track({
        provider: "openai",
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: latencyMs,
        request_id: (response?.id as string) ?? undefined,
        ...tags,
      });
    }

    return result;
  };

  return client;
}

/**
 * Wrap an Anthropic client instance to automatically track usage with TokenLens.
 *
 * @example
 * ```ts
 * import Anthropic from "@anthropic-ai/sdk";
 * import { TokenLens, wrapAnthropic } from "@tokenlens/sdk";
 *
 * const tl = new TokenLens({ apiKey: "tl_..." });
 * const anthropic = wrapAnthropic(new Anthropic(), tl);
 *
 * // All message creations are now automatically tracked
 * const response = await anthropic.messages.create({
 *   model: "claude-sonnet-4-20250514",
 *   max_tokens: 1024,
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
export function wrapAnthropic<T extends Record<string, unknown>>(
  client: T,
  tracker: TokenLens,
  defaultTags?: TagContext
): T {
  const messages = client.messages as Record<string, unknown> | undefined;
  if (!messages) return client;

  const originalCreate = messages.create as (...args: unknown[]) => Promise<unknown>;

  messages.create = async function (...args: unknown[]): Promise<unknown> {
    const startTime = Date.now();
    const params = args[0] as Record<string, unknown> | undefined;
    const model = (params?.model as string) ?? "unknown";

    const result = await originalCreate.apply(this, args);

    const latencyMs = Date.now() - startTime;
    const response = result as Record<string, unknown>;
    const usage = response?.usage as Record<string, number> | undefined;

    if (usage) {
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;

      // Extract tags from metadata if present
      const metadata = params?.metadata as Record<string, string> | undefined;
      const tags = {
        feature_tag: metadata?.tokenlens_feature ?? defaultTags?.feature,
        user_tag: metadata?.tokenlens_user ?? defaultTags?.user,
        team_tag: metadata?.tokenlens_team ?? defaultTags?.team,
        environment: metadata?.tokenlens_environment ?? defaultTags?.environment,
      };

      tracker.track({
        provider: "anthropic",
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: latencyMs,
        request_id: (response?.id as string) ?? undefined,
        ...tags,
      });
    }

    return result;
  };

  return client;
}
