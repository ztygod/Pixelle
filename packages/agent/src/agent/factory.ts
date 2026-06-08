import type {AgentConfig} from "../config/index.js";
import {Agent} from "./agent.js";
import type {AgentOptions} from "./types.js";

/** Creates a default agent runtime from either full options or loaded config. */
export function createAgentRuntime(options: AgentOptions): Agent;
export function createAgentRuntime(config: AgentConfig): Agent;
export function createAgentRuntime(input: AgentOptions | AgentConfig): Agent {
  if ("runtime" in input && "llm" in input) {
    return new Agent({config: input});
  }

  return new Agent(input as AgentOptions);
}
