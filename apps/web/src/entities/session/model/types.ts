import type {SessionId} from "@pixelle/types";

export interface Session {
  id: SessionId | string;
  workspaceId: string;
  title: string;
  createdAt: number;
}
