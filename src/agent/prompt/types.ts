export type SystemPromptSource = "core" | "mode" | "config" | "run" | "response";

/** One stable, inspectable component of the system prompt. */
export type SystemPromptSection = {
  id: string;
  title: string;
  content: string;
  source: SystemPromptSource;
  locked: boolean;
};

/** Versioned system prompt resolved once for an agent run. */
export type ResolvedSystemPrompt = {
  version: "pixelle-coding-agent/v1";
  sections: readonly SystemPromptSection[];
  content: string;
};

export type ResolveSystemPromptInput = {
  mode: "ask" | "edit";
  configInstructions: readonly string[];
  runInstructions: readonly string[];
};
