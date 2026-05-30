export interface PromptSubmission {
  content: string;
  submittedAt: number;
}

export function createPromptSubmission(content: string): PromptSubmission | undefined {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return undefined;
  }

  return {
    content: trimmedContent,
    submittedAt: Date.now(),
  };
}
