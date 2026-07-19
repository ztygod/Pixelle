import type {AgentContextProvider, AgentContextValue} from "../../agent/types.js";
import type {AgentMemory} from "../../agent/runtime/memory.js";
import type {AgentRunState} from "../../agent/runtime/run-state.js";
import type {ContextDocument, ContextSection} from "../types.js";
import {ContextProviderExecutor} from "./context-provider-executor.js";

export type ContextCollectorOptions = {
  memory: AgentMemory;

  /**
   * Static context providers.
   *
   * These providers are registered when creating Agent runtime.
   */
  contextProviders?: readonly AgentContextProvider[];
};

export type CollectContextOptions = {
  stage?: ContextDocument["metadata"]["stage"];
};

/**
 * Collects context sources and builds ContextDocument.
 *
 * Responsibilities:
 * - load memory
 * - collect workspace/user context
 * - execute context providers
 * - convert values into ContextSection
 *
 * Not responsible for:
 * - token budgeting
 * - compression
 * - ordering policy
 * - prompt assembling
 */
export class ContextCollector {
  private readonly contextProviders: readonly AgentContextProvider[];

  private readonly providerExecutor: ContextProviderExecutor;

  constructor(private readonly options: ContextCollectorOptions) {
    this.contextProviders = options.contextProviders ?? [];

    this.providerExecutor = new ContextProviderExecutor();
  }

  async collect(
    run: AgentRunState,
    options: CollectContextOptions = {},
  ): Promise<ContextDocument> {
    const sections: ContextSection[] = [];

    /**
     * Memory Context
     */
    const memories = await this.loadMemory(run);

    sections.push(...memories.map((value) => toContextSection(value, "memory")));

    /**
     * User provided context
     */
    sections.push(
      ...(run.input.context ?? []).map((value) => toContextSection(value, "user")),
    );

    /**
     * Workspace Context
     */
    sections.push({
      title: "Workspace Profile",

      priority: 100,

      content: JSON.stringify(run.workspaceProfile, null, 2),

      source: {
        kind: "workspace",
      },
    });

    /**
     * Context Providers
     */
    const providers = [...this.contextProviders, ...(run.input.contextProviders ?? [])];

    const providerResults = await this.providerExecutor.execute(providers, run.context);

    for (const result of providerResults) {
      /**
       * Non critical provider failure
       *
       * Executor already isolates errors.
       * Collector only skips invalid results.
       */
      if (!result.success) {
        console.warn(`[ContextProvider] ${result.provider.name} failed:`, result.error);

        continue;
      }

      if (result.value === undefined) {
        continue;
      }

      sections.push(toProviderSection(result.provider, result.value));
    }

    return {
      sections,
      transcript: run.messages,
      metadata: {
        runId: run.runId,
        iteration: run.iteration,
        stage: options.stage ?? "agent",
      },
    };
  }

  private async loadMemory(run: AgentRunState): Promise<AgentContextValue[]> {
    const runMemory = await this.options.memory.loadRunMemory?.(run);
    const projectMemory = await this.options.memory.loadProjectMemory?.(run);

    return [...(projectMemory ?? []), ...(runMemory ?? [])];
  }
}

/**
 * Convert common context value to ContextSection.
 */
function toContextSection(
  value: AgentContextValue,
  source: "memory" | "user",
): ContextSection {
  if (typeof value === "string") {
    return {
      content: value,

      source: {
        kind: source,
      },
    };
  }

  return {
    ...value,

    source: {
      kind: source,
    },
  };
}

/**
 * Convert provider result to ContextSection.
 */
function toProviderSection(
  provider: AgentContextProvider,
  value: AgentContextValue,
): ContextSection {
  if (typeof value === "string") {
    return {
      title: provider.name,

      content: value,

      source: {
        kind: "provider",

        ref: provider.name,
      },
    };
  }

  return {
    title: value.title ?? provider.name,

    ...value,

    source: {
      kind: "provider",

      ref: provider.name,
    },
  };
}
