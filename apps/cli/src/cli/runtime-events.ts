import type {PixelleEvent} from "@pixelle/agent";
import type {CliEvent} from "./types.js";

export function agentEventToCliEvent(event: PixelleEvent): CliEvent | undefined {
  switch (event.type) {
    case "conversation.user_message":
      return {
        type: "user_message",
        id: event.id ? String(event.id) : undefined,
        content: event.content,
        createdAt: event.createdAt,
      };
    case "conversation.assistant_delta":
      return {
        type: "assistant_delta",
        messageId: String(event.messageId),
        delta: event.delta,
        stage: event.stage,
        createdAt: event.createdAt,
      };
    case "conversation.assistant_stage":
      return {
        type: "assistant_stage",
        messageId: String(event.messageId),
        stage: event.stage,
        createdAt: event.createdAt,
      };
    case "conversation.assistant_done":
      return {
        type: "assistant_done",
        messageId: String(event.messageId),
        createdAt: event.createdAt,
      };
    case "tool.call_started":
      return {
        type: "tool_start",
        id: String(event.id),
        name: event.name,
        input: event.input,
        description: event.description,
        status: event.status,
        createdAt: event.createdAt,
      };
    case "tool.call_completed":
      return {
        type: "tool_done",
        id: String(event.id),
        name: event.name,
        output: event.output,
        summary: event.summary,
        createdAt: event.createdAt,
      };
    case "tool.call_failed":
      return {
        type: "tool_error",
        id: String(event.id),
        name: event.name,
        error: event.error,
        createdAt: event.createdAt,
      };
    case "artifact.image_added":
      return {
        type: "image_preview",
        id: event.id ? String(event.id) : undefined,
        path: event.path,
        alt: event.alt,
        createdAt: event.createdAt,
      };
    case "runtime.error":
      return {
        type: "error",
        message: event.message,
        detail: event.detail,
        createdAt: event.createdAt,
      };
    default:
      return undefined;
  }
}
