import type {
  ChangeSetState,
  CliEvent,
  CliMessage,
  ImagePreviewState,
  ToolCallState,
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

export function reduceCliState(state: CliViewState, action: CliAction): CliViewState {
  return reduceCliEvent(state, action.event);
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

    case "user_message":
      return {
        ...state,
        ...viewEventStats,
        showHelp: false,
        messages: [
          ...state.messages,
          {
            id: event.id ?? createId("user"),
            role: "user",
            content: event.content,
            createdAt: eventCreatedAt,
            order: eventOrder,
          },
        ],
      };

    case "assistant_delta": {
      const existing = state.messages.find((message) => message.id === event.messageId);
      if (!existing) {
        return {
          ...state,
          ...viewEventStats,
          showHelp: false,
          messages: [
            ...state.messages,
            {
              id: event.messageId,
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
          message.id === event.messageId
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

    case "assistant_stage": {
      const existing = state.messages.find((message) => message.id === event.messageId);
      if (!existing) {
        return {
          ...state,
          ...viewEventStats,
          showHelp: false,
          messages: [
            ...state.messages,
            {
              id: event.messageId,
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
          message.id === event.messageId
            ? {
                ...message,
                stage: event.stage,
                streaming: event.stage !== "complete" ? message.streaming : false,
              }
            : message,
        ),
      };
    }

    case "assistant_done":
      return {
        ...state,
        ...viewEventStats,
        messages: state.messages.map((message) =>
          message.id === event.messageId
            ? {
                ...message,
                streaming: false,
                stage: "complete",
              }
            : message,
        ),
      };

    case "tool_start":
      return {
        ...state,
        ...viewEventStats,
        tools: [
          ...state.tools.filter((tool) => tool.id !== event.id),
          {
            id: event.id,
            name: event.name,
            status: event.status ?? "running",
            input: event.input,
            description: event.description,
            createdAt: eventCreatedAt,
            order: eventOrder,
            startedAt: event.status === "pending" ? undefined : eventCreatedAt,
          },
        ],
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
                output: event.output,
                summary: event.summary,
                completedAt: eventCreatedAt,
                durationMs: getDurationMs(tool, eventCreatedAt),
              }
            : tool,
        ),
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
                error: event.error,
                errorCode: event.code,
                errorData: event.data,
                completedAt: eventCreatedAt,
                durationMs: getDurationMs(tool, eventCreatedAt),
              }
            : tool,
        ),
        lastError: event.error,
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
  }
}

function getDurationMs(tool: ToolCallState, completedAt: number): number | undefined {
  const startedAt = tool.startedAt ?? tool.createdAt;
  if (!startedAt || completedAt < startedAt) {
    return undefined;
  }

  return completedAt - startedAt;
}
