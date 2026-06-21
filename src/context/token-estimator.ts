/** Estimates tokens using the runtime's coarse character-based heuristic. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
