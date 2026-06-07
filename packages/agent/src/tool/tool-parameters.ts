import type {ToolParameterSchema} from "./types.js";

export type LLMToolParametersSchema = Record<string, unknown>;

export type ToolParametersSchemaConverter = (
  parameters: ToolParameterSchema,
) => LLMToolParametersSchema;

export function toLLMToolParametersSchema(
  _parameters: ToolParameterSchema,
): LLMToolParametersSchema {
  // Placeholder for a future zod-to-JSON-schema adapter used by LLM providers.
  return {};
}
