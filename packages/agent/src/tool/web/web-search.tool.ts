import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";

const webSearchParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  query: z
    .string()
    .min(1)
    .describe(
      "External web search query for finding relevant pages or current information. Use web_fetch instead when you already know the URL.",
    ),
  maxResults: z
    .number()
    .positive()
    .optional()
    .describe("Maximum number of search results requested from a future provider."),
});

export const webSearchTool: Tool<
  typeof webSearchParameters,
  {query: string; results: unknown[]; provider: null}
> = {
  definition: {
    name: "web_search",
    description:
      "Search external web information when you do not know the exact page URL or need to discover relevant sources. Do not use this to read a specific known URL; use web_fetch for that. This first implementation is a reserved provider interface and returns an empty result list until a search provider is configured.",
    parameters: webSearchParameters,
  },
  execute(input, context) {
    requireNetworkPermission(context, "web_search");

    return okToolResult("Web search provider is not configured.", {
      query: input.query,
      results: [],
      provider: null,
    });
  },
};

function requireNetworkPermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.network) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "Network permission is required.",
      toolName,
    });
  }
}
