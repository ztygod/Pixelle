/** Assembles the final system prompt from base prompt, output rules, and context. */
export class SystemPromptAssembler {
  assemble(input: {
    systemPrompt?: string;
    outputInstructions?: string;
    contextText: string;
  }): string {
    const promptParts = [input.systemPrompt, input.outputInstructions].filter(
      (part): part is string => Boolean(part),
    );
    const prompt = promptParts.join("\n\n");

    if (!input.contextText) {
      return prompt;
    }

    if (!prompt) {
      return `# Runtime Context\n${input.contextText}`;
    }

    return `${prompt}\n\n# Runtime Context\n${input.contextText}`;
  }
}
