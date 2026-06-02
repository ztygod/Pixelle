import type {AgentStage, SessionId} from "@/shared/types/agent-types";

export interface Run {
  id: string;
  sessionId: SessionId | string;
  stage: AgentStage;
  status: "queued" | "running" | "complete" | "error";
}
