import {z} from "zod";

/** Validates the LLM section of pixelle.toml after env overrides. */
export const LLMConfigSchema = z.object({
  provider: z.enum(["openai-compatible", "anthropic"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0).max(10),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
});

/** Validates runtime controls for agent execution. */
export const RuntimeConfigSchema = z.object({
  maxIterations: z.number().int().positive(),
  enablePlanning: z.boolean(),
  enableReflection: z.boolean(),
});

/** Validates the complete agent configuration returned to callers. */
export const AgentConfigSchema = z.object({
  llm: LLMConfigSchema,
  runtime: RuntimeConfigSchema,
});

/** Validates partial TOML input before environment overrides complete it. */
export const AgentConfigInputSchema = z.object({
  llm: LLMConfigSchema.partial().optional(),
  runtime: RuntimeConfigSchema.partial().optional(),
});

export type AgentConfigSchemaValue = z.infer<typeof AgentConfigSchema>;
export type AgentConfigInputSchemaValue = z.infer<typeof AgentConfigInputSchema>;
