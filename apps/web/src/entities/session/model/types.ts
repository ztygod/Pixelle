import type {SessionId} from "@pixelle/agent";

export interface Session {
  id: SessionId | string;
  workspaceId: string;
  title: string;
  createdAt: number;
}
