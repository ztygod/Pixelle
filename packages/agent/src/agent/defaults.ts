import type {AgentConfig} from "../config/index.js";
import type {BaseLLMClient} from "../llm/index.js";
import type {ToolPermissions} from "../tool/index.js";
import type {AgentRuntimeConfig} from "./types.js";

export const DEFAULT_PERMISSIONS: Required<ToolPermissions> = {
  readFile: true,
  writeFile: false,
  network: false,
  shell: false,
};

export const DEFAULT_MAX_ITERATIONS = 12;
export const DEFAULT_TOKEN_LIMIT = 32_000;
export const DEFAULT_SYSTEM_PROMPT =
  "You are Pixelle, an autonomous coding agent. Solve the user's request by reasoning carefully, using tools when needed, and explaining the final outcome clearly.";

/** Applies runtime defaults without mutating the caller's config object. */
export function normalizeConfig(
  config: AgentRuntimeConfig | AgentConfig,
): AgentRuntimeConfig {
  return {
    ...config,
    runtime: {
      maxIterations: config.runtime.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      tokensLimit: config.runtime.tokensLimit ?? DEFAULT_TOKEN_LIMIT,
      systemPrompt: config.runtime.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      workspaceDir: config.runtime.workspaceDir,
    },
  };
}

export function missingLLMClient(): BaseLLMClient {
  throw new Error("Agent requires either config.llm or an explicit llm client.");
}
