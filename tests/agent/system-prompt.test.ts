import {describe, expect, it} from "vitest";

import {Agent} from "../../src/agent/index.js";
import {createDefaultTokenEstimator} from "../../src/context/index.js";
import {EventBus, type PixelleEvent} from "../../src/events/index.js";
import {BaseLLMClient} from "../../src/llm/index.js";
import type {LLMGenerateInput, LLMResponse} from "../../src/llm/types.js";
import type {WorkspaceProfile} from "../../src/runtime/index.js";

class CapturingLLMClient extends BaseLLMClient {
  request: LLMGenerateInput | undefined;

  override async generate(input: LLMGenerateInput): Promise<LLMResponse> {
    this.request = input;
    return {content: "Done.", toolCalls: []};
  }
}

describe("ContextManager system prompt", () => {
  it("fails before provider invocation when fixed request costs exceed the window", async () => {
    const workspaceRoot = process.cwd();
    const llm = new CapturingLLMClient();
    const result = await new Agent({
      config: {
        runtime: {
          systemInstructions: [],
          workspaceDir: workspaceRoot,
          maxIterations: 1,
          maxRepairAttempts: 0,
          tokensLimit: 1_000,
          rollbackOnFailure: false,
        },
        verification: {enabled: false, commands: []},
        trace: {enabled: false, directory: workspaceRoot},
      },
      llm,
      workspaceScanner: {
        async scan(): Promise<WorkspaceProfile> {
          return {
            root: workspaceRoot,
            packageManager: "pnpm",
            scripts: {},
            projectFiles: [],
            detectedFrameworks: [],
          };
        },
      },
    }).run({prompt: "test"});

    expect(result.stopReason).toBe("error");
    expect(result.error).toMatchObject({code: "CONTEXT_WINDOW_EXCEEDED"});
    expect(llm.request).toBeUndefined();
  });

  it("uses the canonical coding-agent prompt and configured instructions", async () => {
    const workspaceRoot = process.cwd();
    const llm = new CapturingLLMClient();
    const profile: WorkspaceProfile = {
      root: workspaceRoot,
      packageManager: "pnpm",
      scripts: {},
      projectFiles: [],
      detectedFrameworks: [],
    };

    await new Agent({
      config: {
        runtime: {
          systemInstructions: ["Base prompt."],
          workspaceDir: workspaceRoot,
          maxIterations: 1,
          maxRepairAttempts: 0,
          tokensLimit: 32_000,
          rollbackOnFailure: false,
        },
        permissions: {
          readFile: true,
          writeFile: false,
          network: false,
          shell: false,
        },
        verification: {
          enabled: false,
          commands: [],
        },
        trace: {
          enabled: false,
          directory: workspaceRoot,
        },
      },
      llm,
      workspaceScanner: {
        async scan(): Promise<WorkspaceProfile> {
          return profile;
        },
      },
    }).run({prompt: "test"});

    const prompt = llm.request?.messages[0]?.content;

    expect(prompt).toContain("# Identity and Mission");
    expect(prompt).toContain("# Configured Instruction\nBase prompt.");
    expect(prompt).toContain("Do not use Markdown tables");
    expect(prompt).toContain("always include a language identifier");
  });

  it("keeps runtime context inputs compatible after context core extraction", async () => {
    const workspaceRoot = process.cwd();
    const llm = new CapturingLLMClient();
    const eventBus = new EventBus<PixelleEvent>();
    const events: PixelleEvent[] = [];
    const profile: WorkspaceProfile = {
      root: workspaceRoot,
      packageManager: "pnpm",
      scripts: {test: "vitest run"},
      projectFiles: ["package.json"],
      detectedFrameworks: ["typescript"],
    };

    eventBus.subscribe((event) => events.push(event));

    await new Agent({
      config: {
        runtime: {
          systemInstructions: ["Config prompt."],
          workspaceDir: workspaceRoot,
          maxIterations: 1,
          maxRepairAttempts: 0,
          tokensLimit: 32_000,
          rollbackOnFailure: false,
        },
        permissions: {
          readFile: true,
          writeFile: false,
          network: false,
          shell: false,
        },
        verification: {
          enabled: false,
          commands: [],
        },
        trace: {
          enabled: false,
          directory: workspaceRoot,
        },
      },
      llm,
      eventBus,
      memory: {
        loadProjectMemory: () => [{title: "Project Memory", content: "project facts"}],
        loadRunMemory: () => ["run facts"],
      },
      contextProviders: [
        {
          name: "Agent Provider",
          build: () => "agent provider facts",
        },
      ],
      workspaceScanner: {
        async scan(): Promise<WorkspaceProfile> {
          return profile;
        },
      },
    }).run({
      prompt: "test",
      systemInstructions: ["Input prompt."],
      context: [{title: "User Context", content: "user facts", priority: 50}],
      contextProviders: [
        {
          name: "Input Provider",
          build: () => ({content: "input provider facts"}),
        },
      ],
    });

    const prompt = llm.request?.messages[0]?.content ?? "";
    const contextBuilt = events.find((event) => event.type === "runtime.context_built");
    const runtimeContext = prompt.split("# Runtime Context\n")[1] ?? "";

    expect(prompt).toContain("# Configured Instruction\nConfig prompt.");
    expect(prompt).toContain("# Run Instruction\nInput prompt.");
    expect(prompt.indexOf("Config prompt.")).toBeLessThan(
      prompt.indexOf("Input prompt."),
    );
    expect(prompt).toContain("Do not use Markdown tables");
    expect(prompt).toContain("# Runtime Context");
    expect(runtimeContext).toContain("## Workspace Profile");
    expect(runtimeContext).toContain('"packageManager": "pnpm"');
    expect(runtimeContext).toContain("## User Context\nuser facts");
    expect(runtimeContext).toContain("## Project Memory\nproject facts");
    expect(runtimeContext).toContain("run facts");
    expect(runtimeContext).toContain("## Agent Provider\nagent provider facts");
    expect(runtimeContext).toContain("## Input Provider\ninput provider facts");
    expect(contextBuilt).toMatchObject({
      type: "runtime.context_built",
    });
    expect(contextBuilt?.tokenEstimate).toBeGreaterThan(
      createDefaultTokenEstimator().countText(prompt),
    );
    expect(
      llm.request?.messages.filter((message) => message.role === "system"),
    ).toHaveLength(1);
  });
});
