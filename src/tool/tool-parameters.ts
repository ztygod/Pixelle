import {z} from "zod";
import type {ToolParameterSchema} from "./types.js";

/** JSON schema shape passed to provider-neutral LLM tool definitions. */
export type LLMToolParametersSchema = Record<string, unknown>;

/** Converts a Zod tool parameter schema into draft-7 JSON schema for LLM APIs. */
export function toLLMToolParametersSchema(
  parameters: ToolParameterSchema,
): LLMToolParametersSchema {
  const schema = z.toJSONSchema(parameters, {
    target: "draft-7",
  }) as Record<string, unknown>;

  delete schema.$schema;
  delete schema.id;

  return schema;
}
