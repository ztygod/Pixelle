import {z} from "zod";

export const LLMConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  timeoutMs: z.number().int().positive(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
});

export const AgentConfigSchema = z.object({
  maxIterations: z.number().int().positive(),
  enablePlanning: z.boolean(),
  enableReflection: z.boolean(),
});

export const ToolsConfigSchema = z.object({
  enabledTools: z.array(z.string().min(1)),
  allowWriteFile: z.boolean(),
  allowRunCommand: z.boolean(),
});

export const PixelleConfigSchema = z.object({
  llm: LLMConfigSchema,
  agent: AgentConfigSchema,
  tools: ToolsConfigSchema,
});

export const LLMConfigInputSchema = LLMConfigSchema.partial();
export const AgentConfigInputSchema = AgentConfigSchema.partial();
export const ToolsConfigInputSchema = ToolsConfigSchema.partial();

export const PixelleConfigInputSchema = z.object({
  llm: LLMConfigInputSchema.optional(),
  agent: AgentConfigInputSchema.optional(),
  tools: ToolsConfigInputSchema.optional(),
});

export type LLMConfigValues = z.infer<typeof LLMConfigSchema>;
export type AgentConfigValues = z.infer<typeof AgentConfigSchema>;
export type ToolsConfigValues = z.infer<typeof ToolsConfigSchema>;
export type PixelleConfigValues = z.infer<typeof PixelleConfigSchema>;
export type PixelleConfigInput = z.infer<typeof PixelleConfigInputSchema>;
