import type {PixelleEvent} from "../events/index.js";
import {inferToolTarget} from "../tool/tool-target.js";
import type {ChangedFileState, CliEvent} from "./types.js";

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
        target: inferToolTarget(event.name, event.target, event.input),
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
        target: inferToolTarget(
          event.name,
          event.target,
          event.result?.display,
          event.display,
          event.result?.data,
          event.output,
        ),
        output: event.result?.data ?? event.output,
        summary: event.result?.message ?? event.summary,
        display: event.result?.display ?? event.display,
        createdAt: event.createdAt,
      };
    case "tool.call_failed":
      return {
        type: "tool_error",
        id: String(event.id),
        name: event.name,
        target: inferToolTarget(
          event.name,
          event.target,
          event.result?.display,
          event.display,
          event.result?.data,
          event.data,
        ),
        error: event.result?.message ?? event.error,
        code: event.result?.code ?? event.code,
        data: event.result?.data ?? event.data,
        display: event.result?.display ?? event.display,
        createdAt: event.createdAt,
      };
    case "tool.call_stream":
      return {
        type: "tool_stream",
        id: String(event.id),
        name: event.name,
        stream: event.stream,
        createdAt: event.createdAt,
      };
    case "runtime.error":
      return {
        type: "error",
        message: event.message,
        detail: event.detail,
        createdAt: event.createdAt,
      };
    case "change_set.applied":
      return {
        type: "change_set",
        id: event.id,
        files:
          event.changes?.map(normalizeChangedFile) ??
          event.files.map((filePath) => ({
            path: filePath,
            status: "modified" as const,
          })),
        checkpointPath: event.checkpointPath,
        createdAt: event.createdAt,
      };
    case "verification.started":
      return {
        type: "verification",
        status: "running",
        commands: event.commands,
        createdAt: event.createdAt,
      };
    case "verification.completed":
      return {
        type: "verification",
        status: event.passed ? "passed" : "failed",
        commands: event.commands,
        createdAt: event.createdAt,
      };
    case "trace.persisted":
      return {
        type: "trace",
        path: event.path,
        createdAt: event.createdAt,
      };
    default:
      return undefined;
  }
}

function normalizeChangedFile(
  file: {
    path: string;
    beforeContent?: string;
    afterContent?: string;
    status: ChangedFileState["status"];
  } & Partial<ChangedFileState>,
): ChangedFileState {
  return {
    path: file.path,
    oldPath: file.oldPath,
    beforeContent: file.beforeContent,
    afterContent: file.afterContent,
    status: file.status,
    diff: file.diff,
    addedLines: file.addedLines,
    removedLines: file.removedLines,
  };
}
