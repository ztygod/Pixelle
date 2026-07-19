import {z} from "zod";

/** Validates the LLM section of pixelle.toml. */
export const LLMConfigSchema = z.object({
  provider: z.enum(["openai-compatible", "anthropic"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0).max(10),
  apiKey: z.string().min(1).optional(),
  apiKeyEnv: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
});

/** Validates runtime controls for agent execution. */
export const RuntimeConfigSchema = z
  .object({
    maxIterations: z.number().int().positive(),
    maxRepairAttempts: z.number().int().min(0),
    tokensLimit: z.number().int().positive(),
    systemInstructions: z.array(z.string().trim().min(1)),
    workspaceDir: z.string().min(1),
    rollbackOnFailure: z.boolean(),
  })
  .strict();

export const PermissionConfigSchema = z.object({
  readFile: z.boolean(),
  writeFile: z.boolean(),
  network: z.boolean(),
  shell: z.boolean(),
});

export const VerificationConfigSchema = z.object({
  enabled: z.boolean(),
  commands: z.array(z.string().min(1)),
});

export const TraceConfigSchema = z.object({
  enabled: z.boolean(),
  directory: z.string().min(1),
});

/** Validates the complete agent configuration returned to callers. */
export const AgentConfigSchema = z.object({
  llm: LLMConfigSchema,
  runtime: RuntimeConfigSchema,
  permissions: PermissionConfigSchema,
  verification: VerificationConfigSchema,
  trace: TraceConfigSchema,
});

/** Validates partial TOML input before environment overrides complete it. */
export const AgentConfigInputSchema = z.object({
  llm: LLMConfigSchema.partial().optional(),
  runtime: RuntimeConfigSchema.partial().optional(),
  permissions: PermissionConfigSchema.partial().optional(),
  verification: VerificationConfigSchema.partial().optional(),
  trace: TraceConfigSchema.partial().optional(),
});

export type AgentConfigSchemaValue = z.infer<typeof AgentConfigSchema>;
export type AgentConfigInputSchemaValue = z.infer<typeof AgentConfigInputSchema>;
