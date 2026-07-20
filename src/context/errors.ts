export type ContextWindowBreakdown = {
  tokenLimit: number;
  hardInputLimit: number;
  systemPromptTokens: number;
  transcriptTokens: number;
  toolSchemaTokens: number;
  requestOverheadTokens: number;
  sectionTokens: number;
};

/** Raised before provider invocation when a legal request cannot fit the model window. */
export class ContextWindowExceededError extends Error {
  readonly code = "CONTEXT_WINDOW_EXCEEDED";

  constructor(
    message: string,
    readonly breakdown: ContextWindowBreakdown,
    readonly diagnostics?: BuildContextDiagnostics,
  ) {
    super(message);
    this.name = "ContextWindowExceededError";
  }
}
import type {BuildContextDiagnostics} from "./types.js";
