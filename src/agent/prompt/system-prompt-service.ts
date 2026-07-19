import {
  CODING_AGENT_CORE_SECTIONS,
  CODING_AGENT_MODE_SECTIONS,
  CODING_AGENT_PROMPT_VERSION,
  CODING_AGENT_RESPONSE_SECTION,
} from "./coding-agent-prompt.js";
import type {
  ResolveSystemPromptInput,
  ResolvedSystemPrompt,
  SystemPromptSection,
} from "./types.js";

/** Resolves the one canonical system prompt used by an agent run. */
export class SystemPromptService {
  resolve(input: ResolveSystemPromptInput): ResolvedSystemPrompt {
    const sections = [
      ...CODING_AGENT_CORE_SECTIONS,
      CODING_AGENT_MODE_SECTIONS[input.mode],
      ...toInstructionSections(input.configInstructions, "config"),
      ...toInstructionSections(input.runInstructions, "run"),
      CODING_AGENT_RESPONSE_SECTION,
    ];

    return {
      version: CODING_AGENT_PROMPT_VERSION,
      sections,
      content: sections.map(formatSystemPromptSection).join("\n\n"),
    };
  }
}

function toInstructionSections(
  instructions: readonly string[],
  source: "config" | "run",
): SystemPromptSection[] {
  return instructions.map((instruction, index) => {
    const content = instruction.trim();
    if (!content) {
      throw new Error(`System prompt ${source} instruction ${index} must not be blank.`);
    }

    return {
      id: `${source}:${index}`,
      title: source === "config" ? "Configured Instruction" : "Run Instruction",
      content,
      source,
      locked: false,
    };
  });
}

function formatSystemPromptSection(section: SystemPromptSection): string {
  return `# ${section.title}\n${section.content}`;
}
