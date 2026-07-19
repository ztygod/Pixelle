import type {LLMMessage} from "../../llm/types.js";
import type {ResolvedSystemPrompt} from "../../agent/prompt/index.js";
import type {TranscriptProjection} from "../types.js";

/** Assembles a context document and projected transcript into model messages. */
export class PromptAssembler {
  assembleSystemPrompt(prompt: ResolvedSystemPrompt, contextText: string): string {
    if (!contextText) {
      return prompt.content;
    }

    return `${prompt.content}\n\n# Runtime Context\n${contextText}`;
  }

  assemble(
    prompt: ResolvedSystemPrompt,
    projection: TranscriptProjection,
    contextText: string,
  ): readonly LLMMessage[] {
    return [
      {role: "system", content: this.assembleSystemPrompt(prompt, contextText)},
      ...projection.messages,
    ];
  }
}
