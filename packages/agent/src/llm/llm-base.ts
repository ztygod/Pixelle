import type {GenerateInput, GenerateResult} from "./types.js";

/**
 * BaseLLMClient defines the smallest shared contract every provider must obey.
 *
 * It deliberately does not expose convertMessages(), convertTools(), or
 * parseResponse() as abstract methods. Those steps are provider implementation
 * details, and forcing every SDK into the same conversion lifecycle would make
 * this base class an early over-abstraction. Runtime only needs generate().
 */
export abstract class BaseLLMClient {
  abstract generate(input: GenerateInput): Promise<GenerateResult>;
}
