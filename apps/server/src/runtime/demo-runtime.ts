import type {AgentEvent} from "@pixelle/events";

export function createDemoRuntimeEvents(
  sessionId: string,
  content: string,
): AgentEvent[] {
  const now = Date.now();
  const metadata = {sessionId, source: "server-demo-runtime"};
  const messageId = `assistant_${now}`;

  return [
    {
      type: "conversation.user_message",
      content,
      createdAt: now,
      metadata,
    },
    {
      type: "tool.call_started",
      id: `context_${now}`,
      name: "context_builder",
      description: "Building project context",
      status: "running",
      createdAt: now + 1,
      metadata,
    },
    {
      type: "tool.call_completed",
      id: `context_${now}`,
      name: "context_builder",
      summary: "Demo context ready",
      createdAt: now + 2,
      metadata,
    },
    {
      type: "conversation.assistant_delta",
      messageId,
      delta:
        "Pixelle server received the message and emitted a shared AgentEvent stream.",
      stage: "planning",
      createdAt: now + 3,
      metadata,
    },
    {
      type: "conversation.assistant_done",
      messageId,
      createdAt: now + 4,
      metadata,
    },
  ];
}
