import { AsyncLocalStorage } from "node:async_hooks";

export interface TagContext {
  feature?: string;
  user?: string;
  team?: string;
  environment?: string;
}

const tagStorage = new AsyncLocalStorage<TagContext>();

/**
 * Run a function with specific tags applied to all TokenLens tracking
 * calls made within it.
 *
 * @example
 * ```ts
 * import { withTags } from "@tokenlens/sdk";
 *
 * // All LLM calls within this block will be tagged
 * const result = await withTags(
 *   { feature: "search", team: "discovery", user: "user-123" },
 *   async () => {
 *     return await openai.chat.completions.create({ ... });
 *   }
 * );
 * ```
 */
export function withTags<T>(tags: TagContext, fn: () => T): T {
  const parentTags = tagStorage.getStore();
  const mergedTags: TagContext = { ...parentTags, ...tags };
  return tagStorage.run(mergedTags, fn);
}

/**
 * Get the current tag context from the async local storage.
 * Used internally by the wrappers.
 */
export function getCurrentTags(): TagContext | undefined {
  return tagStorage.getStore();
}

/**
 * Create a tagged wrapper that applies tags to all tracking within a scope.
 *
 * @example
 * ```ts
 * import { createTaggedScope } from "@tokenlens/sdk";
 *
 * const withSearch = createTaggedScope({ feature: "search" });
 *
 * // Use it to wrap any async function
 * const results = await withSearch(async () => {
 *   return await llm.complete("find products...");
 * });
 * ```
 */
export function createTaggedScope(tags: TagContext) {
  return function <T>(fn: () => T): T {
    return withTags(tags, fn);
  };
}
