import type {
  AgentContextProvider,
  AgentContextValue,
  AgentRunContext,
  RunInternalOptions,
} from "./types.js";
import type {EventBus, PixelleEvent} from "../eventsbus/index.js";
import {createEventMetadata, emitAgentEvent} from "./events.js";
import {DEFAULT_SYSTEM_PROMPT} from "./defaults.js";
import {AgentMiddlewarePipeline} from "./middleware.js";

/** Builds the reserved runtime context section injected into the system prompt. */
export async function buildRuntimeContext(input: {
  context: AgentRunContext;
  middleware: AgentMiddlewarePipeline;
  contextProviders: readonly AgentContextProvider[];
  eventBus: EventBus<PixelleEvent>;
  options: RunInternalOptions;
}): Promise<string> {
  const {context, middleware} = input;
  await middleware.beforeContextBuild(context);

  const providers = [
    ...input.contextProviders,
    ...(context.input.contextProviders ?? []),
  ];
  const values = [...(context.input.context ?? [])];

  for (const provider of providers) {
    const value = await provider.build(context);
    values.push(
      typeof value === "string"
        ? {title: provider.name, content: value}
        : {title: value.title ?? provider.name, ...value},
    );
  }

  const contextText = truncateContext(
    values.sort(compareContextValue).map(formatContextValue).filter(Boolean),
    context.config.runtime.tokensLimit,
  );
  const nextContextText = await middleware.afterContextBuild(
    contextText,
    context,
  );

  emitAgentEvent(
    input.eventBus,
    {
      type: "runtime.context_built",
      tokenEstimate: estimateTokens(nextContextText),
      metadata: createEventMetadata(
        context.input,
        context.sessionId,
        context.traceId,
      ),
    },
    input.options,
  );

  return nextContextText;
}

/** Combines the configured system prompt with the reserved runtime context. */
export function buildSystemPrompt(
  context: AgentRunContext,
  contextText: string,
): string {
  const systemPrompt =
    context.input.systemPrompt ??
    context.config.runtime.systemPrompt ??
    DEFAULT_SYSTEM_PROMPT;

  if (!contextText) {
    return systemPrompt;
  }

  return `${systemPrompt}\n\n# Runtime Context\n${contextText}`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatContextValue(value: AgentContextValue): string {
  if (typeof value === "string") {
    return value.trim();
  }

  const content = value.content.trim();
  if (!content) {
    return "";
  }

  return value.title ? `## ${value.title}\n${content}` : content;
}

function compareContextValue(
  left: AgentContextValue,
  right: AgentContextValue,
): number {
  return getContextPriority(right) - getContextPriority(left);
}

function getContextPriority(value: AgentContextValue): number {
  return typeof value === "string" ? 0 : (value.priority ?? 0);
}

function truncateContext(blocks: string[], tokenLimit: number): string {
  const maxChars = Math.max(0, Math.floor(tokenLimit * 4 * 0.35));
  let remaining = maxChars;
  const selectedBlocks: string[] = [];

  for (const block of blocks) {
    if (remaining <= 0) {
      break;
    }

    const separatorLength = selectedBlocks.length ? 2 : 0;
    const allowed = remaining - separatorLength;
    if (allowed <= 0) {
      break;
    }

    selectedBlocks.push(
      block.length > allowed ? block.slice(0, allowed) : block,
    );
    remaining -= Math.min(block.length, allowed) + separatorLength;
  }

  return selectedBlocks.join("\n\n");
}
