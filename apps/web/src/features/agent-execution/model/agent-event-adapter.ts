import type {PixelleEvent} from "@pixelle/agent";
import {useMessageStore} from "@/entities/message";

export function applyAgentEvent(event: PixelleEvent) {
  if (event.type === "conversation.assistant_delta") {
    useMessageStore
      .getState()
      .appendAssistantDelta(String(event.messageId), event.delta);
  }
}
