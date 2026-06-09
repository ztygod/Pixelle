import type {
  LLMGenerateInput,
  LLMResponse,
  LLMStreamChunk,
  LLMStreamInput,
} from "./types.js";

/** Base contract for all Pixelle LLM clients. */
export abstract class BaseLLMClient {
  abstract generate(input: LLMGenerateInput): Promise<LLMResponse>;

  async *stream(input: LLMStreamInput): AsyncIterable<LLMStreamChunk> {
    const response = await this.generate(input);
    if (response.content) {
      yield {
        type: "content_delta",
        content: response.content,
        raw: response.raw,
      };
    }

    yield {
      type: "done",
      response,
      raw: response.raw,
    };
  }
}
