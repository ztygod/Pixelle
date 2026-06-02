import type {SessionId} from "@/shared/types/agent-types";

export interface Session {
  id: SessionId | string;
  workspaceId: string;
  title: string;
  createdAt: number;
}
