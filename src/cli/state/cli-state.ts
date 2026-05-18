import type {
  CliEvent,
  CliMessage,
  ImagePreviewState,
  ToolCallState,
} from "../events/types.js";
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
  const createdAt = event.createdAt ?? Date.now();
  const meta = {
    eventCount: state.eventCount + 1,
    lastEventType: event.type,
  };

  switch (event.type) {
    case "user_message":
      return {
        ...state,
        ...meta,
        showHelp: false,
        messages: [
          ...state.messages,
          {
            id: event.id ?? createId("user"),
            role: "user",
            content: event.content,
            createdAt,
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
          ...meta,
          showHelp: false,
          messages: [
            ...state.messages,
            {
              id: event.messageId,
              role: "assistant",
              content: event.delta,
              createdAt,
              streaming: true,
            },
          ],
        };
      }

      return {
        ...state,
        ...meta,
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
        ...meta,
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
        ...meta,
        tools: [
          ...state.tools.filter((tool) => tool.id !== event.id),
          {
            id: event.id,
            name: event.name,
            status: "running",
            input: event.input,
            description: event.description,
            createdAt,
          },
        ],
      };

    case "tool_done":
      return {
        ...state,
        ...meta,
        tools: state.tools.map((tool) =>
          tool.id === event.id
            ? {
                ...tool,
                status: "done",
                output: event.output,
                summary: event.summary,
                completedAt: createdAt,
              }
            : tool,
        ),
      };

    case "tool_error":
      return {
        ...state,
        ...meta,
        tools: state.tools.map((tool) =>
          tool.id === event.id
            ? {
                ...tool,
                status: "error",
                error: event.error,
                completedAt: createdAt,
              }
            : tool,
        ),
        lastError: event.error,
      };

    case "image_preview":
      return {
        ...state,
        ...meta,
        images: [
          ...state.images,
          {
            id: event.id ?? createId("image"),
            path: event.path,
            alt: event.alt,
            createdAt,
          },
        ],
      };

    case "error":
      return {
        ...state,
        ...meta,
        lastError: event.message,
        messages: [
          ...state.messages,
          {
            id: createId("error"),
            role: "error",
            content: event.message,
            createdAt,
          },
        ],
      };
  }
}

