import type {AgentStage, MessageId, SessionId} from "@pixelle/types";

export interface Message {
  id: MessageId | string;
  sessionId: SessionId | string;
  role: "user" | "assistant" | "system";
  content: string;
  stage?: AgentStage;
  createdAt: number;
}
