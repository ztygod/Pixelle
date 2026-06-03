import type {ToolsConfigValues} from "./types.js";

export class ToolsConfig {
  readonly enabledTools: readonly string[];
  readonly allowWriteFile: boolean;
  readonly allowRunCommand: boolean;

  constructor(values: ToolsConfigValues) {
    // Tool permissions are data only here; policy decisions stay in the runtime
    // and tool execution layers that consume this configuration.
    this.enabledTools = [...values.enabledTools];
    this.allowWriteFile = values.allowWriteFile;
    this.allowRunCommand = values.allowRunCommand;
  }

  toJSON(): ToolsConfigValues {
    return {
      enabledTools: [...this.enabledTools],
      allowWriteFile: this.allowWriteFile,
      allowRunCommand: this.allowRunCommand,
    };
  }
}
