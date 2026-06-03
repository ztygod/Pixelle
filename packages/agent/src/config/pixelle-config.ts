import {AgentConfig} from "./agent-config.js";
import {LLMConfig} from "./llm-config.js";
import {PixelleConfigSchema} from "./schemas.js";
import {ToolsConfig} from "./tools-config.js";
import type {PixelleConfigValues} from "./types.js";

export class PixelleAgentConfig {
  readonly llm: LLMConfig;
  readonly agent: AgentConfig;
  readonly tools: ToolsConfig;

  constructor(values: PixelleConfigValues) {
    // PixelleAgentConfig is the single configuration entry point for the agent
    // package, so runtime code can depend on one object instead of knowing
    // where each configuration source came from.
    const parsedValues = PixelleConfigSchema.parse(values);
    this.llm = new LLMConfig(parsedValues.llm);
    this.agent = new AgentConfig(parsedValues.agent);
    this.tools = new ToolsConfig(parsedValues.tools);
  }

  toJSON(): PixelleConfigValues {
    return {
      llm: this.llm.toJSON(),
      agent: this.agent.toJSON(),
      tools: this.tools.toJSON(),
    };
  }
}
