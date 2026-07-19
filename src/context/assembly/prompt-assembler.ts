import type {LLMMessage} from "../../llm/types.js";
import type {ContextDocument, TranscriptProjection} from "../types.js";

/** Assembles a context document and projected transcript into model messages. */
export class PromptAssembler {
  assembleSystemPrompt(document: ContextDocument, contextText: string): string {
    const promptParts = [document.systemPrompt, document.outputInstructions].filter(
      (part): part is string => Boolean(part),
    );
    const prompt = promptParts.join("\n\n");

    if (!contextText) {
      return prompt;
    }

    if (!prompt) {
      return `# Runtime Context\n${contextText}`;
    }

    return `${prompt}\n\n# Runtime Context\n${contextText}`;
  }

  assemble(
    document: ContextDocument,
    projection: TranscriptProjection,
    contextText: string,
  ): readonly LLMMessage[] {
    return [
      {role: "system", content: this.assembleSystemPrompt(document, contextText)},
      ...projection.messages,
    ];
  }
}
