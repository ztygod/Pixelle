import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";

const webFetchParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  url: z
    .string()
    .url()
    .describe(
      "Specific HTTP or HTTPS URL to fetch. The caller must already know the URL.",
    ),
  maxLength: z
    .number()
    .positive()
    .optional()
    .describe("Maximum number of characters of response text to return."),
});

export const webFetchTool: Tool<
  typeof webFetchParameters,
  {url: string; text: string}
> = {
  definition: {
    name: "web_fetch",
    description:
      "Fetch text from a specific known URL. Use this when you already have the exact webpage URL and need its page text. This tool does not discover unknown pages. Returns the final URL string and capped response text. This is a network tool and does not access workspace files.",
    parameters: webFetchParameters,
  },
  async execute(input, context) {
    requireNetworkPermission(context, "web_fetch");

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

    return okToolResult("Fetched webpage text.", {
      url,
      text: text.slice(0, maxLength),
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
