import type {
  ChangeSetState,
  CliMessage,
  ImagePreviewState,
  ToolCallState,
  TraceState,
  VerificationState,
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
    }
  | {
      kind: "change_set";
      key: string;
      createdAt: number;
      order: number;
      changeSet: ChangeSetState;
    }
  | {
      kind: "verification";
      key: string;
      createdAt: number;
      order: number;
      verification: VerificationState;
    }
  | {
      kind: "trace";
      key: string;
      createdAt: number;
      order: number;
      trace: TraceState;
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
    ...state.changeSets.map((changeSet) => ({
      kind: "change_set" as const,
      key: `change_set:${changeSet.id}`,
      createdAt: changeSet.createdAt,
      order: changeSet.order,
      changeSet,
    })),
    ...state.verifications.map((verification) => ({
      kind: "verification" as const,
      key: `verification:${verification.id}`,
      createdAt: verification.createdAt,
      order: verification.order,
      verification,
    })),
    ...state.traces.map((trace) => ({
      kind: "trace" as const,
      key: `trace:${trace.id}`,
      createdAt: trace.createdAt,
      order: trace.order,
      trace,
    })),
  ].sort(compareTimelineItems);
}

function compareTimelineItems(left: CliTimelineItem, right: CliTimelineItem): number {
  return left.createdAt - right.createdAt || left.order - right.order;
}
