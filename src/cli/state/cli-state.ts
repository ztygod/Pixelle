import type {
  CliEvent,
  CliMessage,
  ImagePreviewState,
  ToolCallState,
} from "../types.js";
import {createId} from "../utils/format.js";

export type CliCommand =
  | {type: "clear"}
  | {type: "debug"}
  | {type: "help"}
  | {type: "exit"};

export type CliViewState = {
  messages: CliMessage[];
  tools: ToolCallState[];
  images: ImagePreviewState[];
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
  debug: false,
  showHelp: false,
  eventCount: 0,
};

export type CliAction =
  | {type: "event"; event: CliEvent}
  | {type: "command"; command: CliCommand};

export function reduceCliState(
  state: CliViewState,
  action: CliAction,
): CliViewState {
  switch (action.type) {
    case "command":
      return reduceCliCommand(state, action.command);
    case "event":
      return reduceCliEvent(state, action.event);
  }
}

export function parseCliCommand(input: string): CliCommand | undefined {
  switch (input.trim()) {
    case "/clear":
      return {type: "clear"};
    case "/debug":
      return {type: "debug"};
    case "/help":
      return {type: "help"};
    case "/exit":
      return {type: "exit"};
    default:
      return undefined;
  }
}

function reduceCliCommand(
  state: CliViewState,
  command: CliCommand,
): CliViewState {
  switch (command.type) {
    case "clear":
      return {
        ...state,
        messages: [],
        tools: [],
        images: [],
        lastError: undefined,
        showHelp: false,
      };
    case "debug":
      return {
        ...state,
        debug: !state.debug,
      };
    case "help":
      return {
        ...state,
        showHelp: !state.showHelp,
      };
    case "exit":
      return state;
  }
}

function reduceCliEvent(state: CliViewState, event: CliEvent): CliViewState {
  const eventCreatedAt = event.createdAt ?? Date.now();
  const eventOrder = state.eventCount + 1;
  const viewEventStats = {
    eventCount: eventOrder,
    lastEventType: event.type,
  };

  switch (event.type) {
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
      const existing = state.messages.find(
        (message) => message.id === event.messageId,
      );
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
                streaming: true,
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
            status: "running",
            input: event.input,
            description: event.description,
            createdAt: eventCreatedAt,
            order: eventOrder,
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
                status: "done",
                output: event.output,
                summary: event.summary,
                completedAt: eventCreatedAt,
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
                completedAt: eventCreatedAt,
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

