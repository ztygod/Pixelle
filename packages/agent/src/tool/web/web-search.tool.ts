import {ToolError} from "../tool-error.js";
import type {Tool, ToolContext} from "../types.js";

type WebSearchInput = {
  query?: unknown;
  maxResults?: unknown;
};

export const webSearchTool: Tool<
  WebSearchInput,
  {query: string; results: unknown[]; provider: null}
> = {
  definition: {
    name: "web_search",
    description: "Reserved web search tool interface for future search providers.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of search results to return.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  execute(input, context) {
    requireNetworkPermission(context, "web_search");

    if (typeof input?.query !== "string" || input.query.length === 0) {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "web_search requires a non-empty string query.",
        toolName: "web_search",
      });
    }

    return {
      query: input.query,
      results: [],
      provider: null,
    };
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
