import type {LLMUsage} from "../llm/types.js";

/** Adds provider usage across model calls while preserving unknown fields. */
export function mergeUsage(
  current: LLMUsage | undefined,
  next: LLMUsage | undefined,
): LLMUsage | undefined {
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }

  return {
    inputTokens: addOptional(current.inputTokens, next.inputTokens),
    outputTokens: addOptional(current.outputTokens, next.outputTokens),
    totalTokens: addOptional(current.totalTokens, next.totalTokens),
  };
}

function addOptional(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }

  return (left ?? 0) + (right ?? 0);
}
