import type {PixelleEvent} from "@pixelle/agent/events";
import {useMessageStore} from "@/entities/message";

export function applyAgentEvent(event: PixelleEvent) {
  if (event.type === "conversation.assistant_delta") {
    useMessageStore
      .getState()
      .appendAssistantDelta(String(event.messageId), event.delta);
  }
}
