import type {PixelleConfigValues} from "./types.js";

export const DEFAULT_PIXELLE_CONFIG: PixelleConfigValues = {
  llm: {
    provider: "openai",
    model: "gpt-4.1",
    temperature: 0.2,
    timeoutMs: 120_000,
  },
  agent: {
    maxIterations: 10,
    enablePlanning: true,
    enableReflection: false,
  },
  tools: {
    enabledTools: ["read_file", "write_file", "edit_file", "run_command"],
    allowWriteFile: true,
    allowRunCommand: true,
  },
};
