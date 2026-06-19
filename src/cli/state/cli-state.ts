import type {
  ChangeSetState,
  CliEvent,
  CliMessage,
  ImagePreviewState,
  ToolCallState,
  ToolStreamState,
  TraceState,
  VerificationState,
} from "../types.js";
import {createId} from "../utils/format.js";

export type CliViewState = {
  messages: CliMessage[];
  tools: ToolCallState[];
  images: ImagePreviewState[];
  changeSets: ChangeSetState[];
  verifications: VerificationState[];
  traces: TraceState[];
  lastError?: string;
  debug: boolean;
  showHelp: boolean;
  eventCount: number;
  lastEventType?: string;
};

export const initialCliState: CliViewState = {
  messages: [],
  tools: [],
  images: [],
  changeSets: [],
  verifications: [],
  traces: [],
  debug: false,
  showHelp: false,
  eventCount: 0,
};

export type CliAction = {type: "event"; event: CliEvent};

const MAX_MESSAGES = 80;
const MAX_TOOLS = 80;
const MAX_IMAGES = 40;
const MAX_CHANGE_SETS = 40;
const MAX_VERIFICATIONS = 40;
const MAX_TRACES = 40;
const MAX_MESSAGE_CONTENT_LENGTH = 24_000;
const MAX_TOOL_PAYLOAD_LENGTH = 12_000;

export function reduceCliState(state: CliViewState, action: CliAction): CliViewState {
  return compactCliState(reduceCliEvent(state, action.event));
}

function reduceCliEvent(state: CliViewState, event: CliEvent): CliViewState {
  const eventCreatedAt = event.createdAt ?? Date.now();
  const eventOrder = state.eventCount + 1;
  const viewEventStats = {
    eventCount: eventOrder,
    lastEventType: event.type,
  };

  switch (event.type) {
    case "cli_clear":
      return {
        ...state,
        ...viewEventStats,
        messages: [],
        tools: [],
        images: [],
        changeSets: [],
        verifications: [],
        traces: [],
        lastError: undefined,
        showHelp: false,
      };

    case "cli_debug_toggle":
      return {
        ...state,
        ...viewEventStats,
        debug: !state.debug,
      };

    case "cli_help_toggle":
      return {
        ...state,
        ...viewEventStats,
        showHelp: !state.showHelp,
      };

    case "runtime_command":
      return {
        ...state,
        ...viewEventStats,
        showHelp: false,
      };

    case "conversation.user_message":
    case "user_message":
      return {
        ...state,
        ...viewEventStats,
        showHelp: false,
        messages: [
          ...state.messages,
          {
            id: event.id ? String(event.id) : createId("user"),
            role: "user",
            content: event.content,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "conversation.assistant_delta":
    case "assistant_delta": {
      const messageId = String(event.messageId);
      const existing = state.messages.find((message) => message.id === messageId);
      if (!existing) {
        return {
          ...state,
          ...viewEventStats,
          showHelp: false,
          messages: [
            ...state.messages,
            {
              id: messageId,
              role: "assistant",
              content: event.delta,
              createdAt: eventCreatedAt,
              order: eventOrder,
              streaming: true,
              stage: event.stage ?? "thinking",
            },
          ],
        };
      }

      return {
        ...state,
        ...viewEventStats,
        messages: state.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: message.content + event.delta,
                createdAt: eventCreatedAt,
                order: eventOrder,
                streaming: true,
                stage: event.stage ?? message.stage,
              }
            : message,
        ),
      };
    }

    case "conversation.assistant_stage":
    case "assistant_stage": {
      const messageId = String(event.messageId);
      const existing = state.messages.find((message) => message.id === messageId);
      if (!existing) {
        return {
          ...state,
          ...viewEventStats,
          showHelp: false,
          messages: [
            ...state.messages,
            {
              id: messageId,
              role: "assistant",
              content: "",
              createdAt: eventCreatedAt,
              order: eventOrder,
              streaming: true,
              stage: event.stage,
            },
          ],
        };
      }

      return {
        ...state,
        ...viewEventStats,
        showHelp: false,
        messages: state.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                stage: event.stage,
                streaming: event.stage !== "complete" ? message.streaming : false,
              }
            : message,
        ),
      };
    }

    case "conversation.assistant_done":
    case "assistant_done":
      return {
        ...state,
        ...viewEventStats,
        messages: state.messages.map((message) =>
          message.id === String(event.messageId)
            ? {
                ...message,
                streaming: false,
                stage: "complete",
              }
            : message,
        ),
      };

    case "tool.call_started":
    case "tool_start": {
      const display = "display" in event ? event.display : undefined;
      return {
        ...state,
        ...viewEventStats,
        tools: [
          ...state.tools.filter((tool) => tool.id !== String(event.id)),
          {
            id: String(event.id),
            name: event.name,
            target: display?.target ?? event.target,
            status: event.status ?? "running",
            input: event.input,
            description: event.description,
            display,
            createdAt: eventCreatedAt,
            order: eventOrder,
            startedAt: event.status === "pending" ? undefined : eventCreatedAt,
          },
        ],
      };
    }

    case "tool.call_completed":
      return {
        ...state,
        ...viewEventStats,
        tools: state.tools.map((tool) => {
          const display = event.result?.display ?? event.display;
          return tool.id === String(event.id)
            ? {
                ...tool,
                status: "success",
                result: event.result,
                target: display?.target ?? event.target ?? tool.target,
                output: event.result?.data ?? event.output,
                summary: event.result?.message ?? event.summary,
                display,
                completedAt: eventCreatedAt,
                durationMs: event.durationMs ?? getDurationMs(tool, eventCreatedAt),
              }
            : tool;
        }),
      };

    case "tool_done":
      return {
        ...state,
        ...viewEventStats,
        tools: state.tools.map((tool) =>
          tool.id === event.id
            ? {
                ...tool,
                status: "success",
                target: event.display?.target ?? event.target ?? tool.target,
                output: event.output,
                summary: event.summary,
                display: event.display,
                completedAt: eventCreatedAt,
                durationMs: getDurationMs(tool, eventCreatedAt),
              }
            : tool,
        ),
      };

    case "tool.call_failed":
      return {
        ...state,
        ...viewEventStats,
        tools: state.tools.map((tool) => {
          const display = event.result?.display ?? event.display;
          return tool.id === String(event.id)
            ? {
                ...tool,
                status: "error",
                result: event.result,
                target: display?.target ?? event.target ?? tool.target,
                error: event.result?.message ?? event.error,
                errorCode: event.result?.code ?? event.code,
                errorData: event.result?.data ?? event.data,
                display,
                completedAt: eventCreatedAt,
                durationMs: event.durationMs ?? getDurationMs(tool, eventCreatedAt),
              }
            : tool;
        }),
        lastError: event.result?.message ?? event.error,
      };

    case "tool_error":
      return {
        ...state,
        ...viewEventStats,
        tools: state.tools.map((tool) =>
          tool.id === event.id
            ? {
                ...tool,
                status: "error",
                target: event.display?.target ?? event.target ?? tool.target,
                error: event.error,
                errorCode: event.code,
                errorData: event.data,
                display: event.display,
                completedAt: eventCreatedAt,
                durationMs: getDurationMs(tool, eventCreatedAt),
              }
            : tool,
        ),
        lastError: event.error,
      };

    case "tool.call_stream":
    case "tool_stream":
      return {
        ...state,
        ...viewEventStats,
        tools: state.tools.map((tool) =>
          tool.id === String(event.id)
            ? {
                ...tool,
                streams: [...(tool.streams ?? []), event.stream],
                createdAt: tool.createdAt,
                order: tool.order,
              }
            : tool,
        ),
      };

    case "image_preview":
      return {
        ...state,
        ...viewEventStats,
        images: [
          ...state.images,
          {
            id: event.id ?? createId("image"),
            path: event.path,
            alt: event.alt,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "change_set.applied":
      return {
        ...state,
        ...viewEventStats,
        changeSets: [
          ...state.changeSets,
          {
            id: event.id,
            files:
              event.changes?.map((file) => ({
                path: file.path,
                beforeContent: file.beforeContent,
                afterContent: file.afterContent,
                status: file.status,
              })) ??
              event.files.map((filePath) => ({
                path: filePath,
                status: "modified" as const,
              })),
            checkpointPath: event.checkpointPath,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "change_set":
      return {
        ...state,
        ...viewEventStats,
        changeSets: [
          ...state.changeSets,
          {
            id: event.id,
            files: event.files,
            checkpointPath: event.checkpointPath,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "verification.started":
      return {
        ...state,
        ...viewEventStats,
        verifications: [
          ...state.verifications,
          {
            id: createId("verification"),
            status: "running",
            commands: event.commands,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "verification.completed":
      return {
        ...state,
        ...viewEventStats,
        verifications: [
          ...state.verifications,
          {
            id: createId("verification"),
            status: event.passed ? "passed" : "failed",
            commands: event.commands,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "verification":
      return {
        ...state,
        ...viewEventStats,
        verifications: [
          ...state.verifications,
          {
            id: createId("verification"),
            status: event.status,
            commands: event.commands,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "trace.persisted":
      return {
        ...state,
        ...viewEventStats,
        traces: [
          ...state.traces,
          {
            id: createId("trace"),
            path: event.path,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "trace":
      return {
        ...state,
        ...viewEventStats,
        traces: [
          ...state.traces,
          {
            id: createId("trace"),
            path: event.path,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "runtime.error":
    case "error":
      return {
        ...state,
        ...viewEventStats,
        lastError: event.message,
        messages: [
          ...state.messages,
          {
            id: createId("error"),
            role: "error",
            content: event.message,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    default:
      return {
        ...state,
        ...viewEventStats,
      };
  }
}

function getDurationMs(tool: ToolCallState, completedAt: number): number | undefined {
  const startedAt = tool.startedAt ?? tool.createdAt;
  if (!startedAt || completedAt < startedAt) {
    return undefined;
  }

  return completedAt - startedAt;
}

function compactCliState(state: CliViewState): CliViewState {
  return {
    ...state,
    messages: state.messages.slice(-MAX_MESSAGES).map((message) => ({
      ...message,
      content: truncateText(message.content, MAX_MESSAGE_CONTENT_LENGTH),
    })),
    tools: state.tools.slice(-MAX_TOOLS).map((tool) => ({
      ...tool,
      input: compactPayload(tool.input),
      output: compactPayload(tool.output),
      errorData: compactPayload(tool.errorData),
      display: compactDisplay(tool.display),
      streams: compactStreams(tool.streams),
    })),
    images: state.images.slice(-MAX_IMAGES),
    changeSets: state.changeSets.slice(-MAX_CHANGE_SETS),
    verifications: state.verifications.slice(-MAX_VERIFICATIONS),
    traces: state.traces.slice(-MAX_TRACES),
  };
}

function compactDisplay<TDisplay extends {preview?: string} | undefined>(
  display: TDisplay,
): TDisplay {
  if (!display?.preview) {
    return display;
  }

  return {
    ...display,
    preview: truncateText(display.preview, MAX_TOOL_PAYLOAD_LENGTH),
  };
}

function compactStreams(
  streams: ToolStreamState[] | undefined,
): ToolStreamState[] | undefined {
  if (!streams?.length) {
    return streams;
  }

  const compacted = streams.map((stream): ToolStreamState => {
    if (!("content" in stream) || typeof stream.content !== "string") {
      return stream;
    }

    return {
      ...stream,
      content: truncateText(stream.content, MAX_TOOL_PAYLOAD_LENGTH),
    };
  });

  return compacted.slice(-80);
}

function compactPayload(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  const serialized = safeJsonStringify(value);
  if (!serialized || serialized.length <= MAX_TOOL_PAYLOAD_LENGTH) {
    return value;
  }

  return `[cli truncated ${serialized.length - MAX_TOOL_PAYLOAD_LENGTH} chars] ${serialized.slice(0, MAX_TOOL_PAYLOAD_LENGTH)}`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n\n[cli truncated ${value.length - maxLength} chars]`;
}

function safeJsonStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
