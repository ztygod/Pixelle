import {useEffect, useState} from "react";
import type {CliEventBus} from "../adapters/event-bus.js";
import type {CliEvent} from "../types/events.js";
import type {
  CliMessage,
  ImagePreviewState,
  ToolCallState,
} from "../types/messages.js";
import {createId} from "../utils/ids.js";

export type CliViewState = {
  messages: CliMessage[];
  tools: ToolCallState[];
  images: ImagePreviewState[];
  lastError?: string;
};

const initialState: CliViewState = {
  messages: [],
  tools: [],
  images: [],
};

export function useCliEvents(
  eventBus: CliEventBus,
  initialEvents: CliEvent[] = [],
): CliViewState {
  const [state, setState] = useState<CliViewState>(() =>
    initialEvents.reduce(reduceCliEvent, initialState),
  );

  useEffect(() => eventBus.subscribe((event) => {
    setState((current) => reduceCliEvent(current, event));
  }), [eventBus]);

  return state;
}

function reduceCliEvent(state: CliViewState, event: CliEvent): CliViewState {
  const createdAt = event.createdAt ?? Date.now();

  switch (event.type) {
    case "user_message":
      return {
        ...state,
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
      const existing = state.messages.find((message) => message.id === event.messageId);
      if (!existing) {
        return {
          ...state,
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
        tools: [
          ...state.tools.filter((tool) => tool.id !== event.id),
          {
            id: event.id,
            name: event.name,
            status: "running",
            input: event.input,
            createdAt,
          },
        ],
      };

    case "tool_done":
      return {
        ...state,
        tools: state.tools.map((tool) =>
          tool.id === event.id
            ? {
                ...tool,
                status: "done",
                output: event.output,
                completedAt: createdAt,
              }
            : tool,
        ),
      };

    case "tool_error":
      return {
        ...state,
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
