import type {
  CliMessage,
  ImagePreviewState,
  ToolCallState,
} from "../types.js";
import type {CliViewState} from "./cli-state.js";

export type CliTimelineItem =
  | {
      kind: "message";
      key: string;
      createdAt: number;
      order: number;
      message: CliMessage;
    }
  | {
      kind: "tool";
      key: string;
      createdAt: number;
      order: number;
      tool: ToolCallState;
    }
  | {
      kind: "image";
      key: string;
      createdAt: number;
      order: number;
      image: ImagePreviewState;
    };

export function selectTimelineItems(state: CliViewState): CliTimelineItem[] {
  return [
    ...state.messages.map((message) => ({
      kind: "message" as const,
      key: `message:${message.id}`,
      createdAt: message.createdAt,
      order: message.order,
      message,
    })),
    ...state.tools.map((tool) => ({
      kind: "tool" as const,
      key: `tool:${tool.id}`,
      createdAt: tool.createdAt,
      order: tool.order,
      tool,
    })),
    ...state.images.map((image) => ({
      kind: "image" as const,
      key: `image:${image.id}`,
      createdAt: image.createdAt,
      order: image.order,
      image,
    })),
  ].sort(compareTimelineItems);
}

function compareTimelineItems(
  left: CliTimelineItem,
  right: CliTimelineItem,
): number {
  return left.createdAt - right.createdAt || left.order - right.order;
}
