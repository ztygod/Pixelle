import {ToolError} from "../tool-error.js";
import type {Tool, ToolContext} from "../types.js";

type WebFetchInput = {
  url?: unknown;
  maxLength?: unknown;
};

export const webFetchTool: Tool<WebFetchInput, {url: string; text: string}> = {
  definition: {
    name: "web_fetch",
    description: "Fetch a URL and return response text with a maximum length.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "HTTP or HTTPS URL to fetch.",
        },
        maxLength: {
          type: "number",
          description: "Maximum number of characters to return.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  async execute(input, context) {
    requireNetworkPermission(context, "web_fetch");

    if (typeof input?.url !== "string") {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "web_fetch requires a string url.",
        toolName: "web_fetch",
      });
    }

    const url = parseHttpUrl(input.url, "web_fetch");
    const maxLength =
      typeof input.maxLength === "number" && input.maxLength > 0
        ? Math.floor(input.maxLength)
        : 20_000;
    const response = await fetch(url, {signal: context.signal});

    if (!response.ok) {
      throw new ToolError({
        code: "TOOL_EXECUTION_FAILED",
        message: `web_fetch failed with HTTP ${response.status}.`,
        toolName: "web_fetch",
        details: {status: response.status, url},
      });
    }

    const text = await response.text();

    return {
      url,
      text: text.slice(0, maxLength),
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

function parseHttpUrl(url: string, toolName: string): string {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Unsupported protocol.");
    }

    return parsedUrl.toString();
  } catch (error) {
    throw new ToolError({
      code: "TOOL_INVALID_INPUT",
      message: "web_fetch requires a valid HTTP or HTTPS URL.",
      toolName,
      cause: error,
    });
  }
}
