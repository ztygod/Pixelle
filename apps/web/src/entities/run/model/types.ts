import type {AgentStage, SessionId} from "@pixelle/agent";

export interface Run {
  id: string;
  sessionId: SessionId | string;
  stage: AgentStage;
  status: "queued" | "running" | "complete" | "error";
}
