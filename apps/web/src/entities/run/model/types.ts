import type {AgentStage, SessionId} from "@pixelle/types";

export interface Run {
  id: string;
  sessionId: SessionId | string;
  stage: AgentStage;
  status: "queued" | "running" | "complete" | "error";
}
