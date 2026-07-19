import type {AgentContextProvider, AgentContextValue} from "../../agent/types.js";
import type {AgentMemory} from "../../agent/runtime/memory.js";
import type {AgentRunState} from "../../agent/runtime/run-state.js";
import type {ContextDocument, ContextSection} from "../types.js";

export type ContextCollectorOptions = {
  memory: AgentMemory;
  contextProviders?: readonly AgentContextProvider[];
};

export type CollectContextOptions = {
  systemPrompt?: string;
  outputInstructions?: string;
  stage?: ContextDocument["metadata"]["stage"];
};

/** Collects run context sources without applying ordering or budget policy. */
export class ContextCollector {
  private readonly contextProviders: AgentContextProvider[];

  constructor(private readonly options: ContextCollectorOptions) {
    this.contextProviders = [...(options.contextProviders ?? [])];
  }

  async collect(
    run: AgentRunState,
    options: CollectContextOptions = {},
  ): Promise<ContextDocument> {
    const sections = [
      ...(await this.loadMemory(run)).map((value) => toContextSection(value, "memory")),
      ...(run.input.context ?? []).map((value) => toContextSection(value, "user")),
      {
        title: "Workspace Profile",
        priority: 100,
        content: JSON.stringify(run.workspaceProfile, null, 2),
        source: {kind: "workspace"},
      } satisfies ContextSection,
    ];

    const providers = [...this.contextProviders, ...(run.input.contextProviders ?? [])];

    for (const provider of providers) {
      const value = await provider.build(run.context);
      sections.push(
        typeof value === "string"
          ? {
              title: provider.name,
              content: value,
              source: {kind: "provider", ref: provider.name},
            }
          : {
              title: value.title ?? provider.name,
              ...value,
              source: {kind: "provider", ref: provider.name},
            },
      );
    }

    return {
      systemPrompt: options.systemPrompt,
      outputInstructions: options.outputInstructions,
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

function toContextSection(
  value: AgentContextValue,
  source: "memory" | "user",
): ContextSection {
  if (typeof value === "string") {
    return {content: value, source: {kind: source}};
  }

  return {...value, source: {kind: source}};
}
