import type {AgentConfigValues} from "./types.js";

export class AgentConfig {
  readonly maxIterations: number;
  readonly enablePlanning: boolean;
  readonly enableReflection: boolean;

  constructor(values: AgentConfigValues) {
    // Keep this class free of I/O so tests and callers can construct it from
    // already validated values without depending on the process environment.
    this.maxIterations = values.maxIterations;
    this.enablePlanning = values.enablePlanning;
    this.enableReflection = values.enableReflection;
  }

  toJSON(): AgentConfigValues {
    return {
      maxIterations: this.maxIterations,
      enablePlanning: this.enablePlanning,
      enableReflection: this.enableReflection,
    };
  }
}
