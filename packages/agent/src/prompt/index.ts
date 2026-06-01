export type PromptRole = "system" | "user" | "assistant" | "tool";

export type PromptMessage = {
  role: PromptRole;
  content: string;
  name?: string;
};

export type PromptContext = {
  systemPrompt?: string;
  userInput: string;
  workspaceSummary?: string;
  history?: readonly PromptMessage[];
};

export type AgentPrompt = {
  messages: readonly PromptMessage[];
};

export type PromptBuilder = {
  build(context: PromptContext): Promise<AgentPrompt>;
};

const frontendCodingSystemPrompt = [
  "You are Pixelle, an AI coding workspace for frontend engineering.",
  "Prefer concrete file edits, explicit assumptions, and verifiable output.",
].join("\n");

function buildAgentPrompt(context: PromptContext): AgentPrompt {
  const messages: PromptMessage[] = [
    {
      role: "system",
      content: context.systemPrompt ?? frontendCodingSystemPrompt,
    },
  ];

  if (context.workspaceSummary) {
    messages.push({
      role: "system",
      content: `Workspace context:\n${context.workspaceSummary}`,
    });
  }

  messages.push(...(context.history ?? []));
  messages.push({
    role: "user",
    content: context.userInput,
  });

  return {messages};
}

export function createPromptBuilder(
  systemPrompt = frontendCodingSystemPrompt,
): PromptBuilder {
  return {
    async build(context) {
      return buildAgentPrompt({
        ...context,
        systemPrompt: context.systemPrompt ?? systemPrompt,
      });
    },
  };
}
