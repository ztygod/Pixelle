import type {
  AgentMiddleware,
  AgentModelRequest,
  AgentModelResponse,
  AgentRunContext,
  AgentRunResult,
  AgentToolCall,
  AgentToolResult,
} from "./types.js";

/** Runs lifecycle middleware in registration order. */
export class AgentMiddlewarePipeline {
  constructor(private readonly middleware: AgentMiddleware[]) {}

  async beforeAgentRun(context: AgentRunContext): Promise<void> {
    for (const middleware of this.middleware) {
      await middleware.beforeAgentRun?.(context);
    }
  }

  async afterAgentRun(
    result: AgentRunResult,
    context: AgentRunContext,
  ): Promise<AgentRunResult> {
    let nextResult = result;
    for (const middleware of this.middleware) {
      nextResult = (await middleware.afterAgentRun?.(nextResult, context)) ?? nextResult;
    }
    return nextResult;
  }

  async beforeModel(
    request: AgentModelRequest,
    context: AgentRunContext,
  ): Promise<AgentModelRequest> {
    let nextRequest = request;
    for (const middleware of this.middleware) {
      nextRequest = (await middleware.beforeModel?.(nextRequest, context)) ?? nextRequest;
    }
    return nextRequest;
  }

  async afterModel(
    response: AgentModelResponse,
    context: AgentRunContext,
  ): Promise<AgentModelResponse> {
    let nextResponse = response;
    for (const middleware of this.middleware) {
      nextResponse =
        (await middleware.afterModel?.(nextResponse, context)) ?? nextResponse;
    }
    return nextResponse;
  }

  async beforeTool(
    call: AgentToolCall,
    context: AgentRunContext,
  ): Promise<AgentToolCall> {
    let nextCall = call;
    for (const middleware of this.middleware) {
      nextCall = (await middleware.beforeTool?.(nextCall, context)) ?? nextCall;
    }
    return nextCall;
  }

  async afterTool(
    toolResult: AgentToolResult,
    context: AgentRunContext,
  ): Promise<AgentToolResult> {
    let nextToolResult = toolResult;
    for (const middleware of this.middleware) {
      nextToolResult =
        (await middleware.afterTool?.(nextToolResult, context)) ?? nextToolResult;
    }
    return nextToolResult;
  }
}
