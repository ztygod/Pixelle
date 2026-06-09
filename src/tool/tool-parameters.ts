import {z} from "zod";
import type {ToolParameterSchema} from "./types.js";

export type LLMToolParametersSchema = Record<string, unknown>;

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
