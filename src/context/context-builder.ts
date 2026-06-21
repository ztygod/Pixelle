import {ContextEngine} from "./context-engine.js";
import type {BuildContextInput, BuildContextResult} from "./types.js";

const defaultContextEngine = new ContextEngine();

/** Builds the final system prompt and model-visible runtime context. */
export function buildRuntimeContext(input: BuildContextInput): BuildContextResult {
  return defaultContextEngine.build(input);
}
