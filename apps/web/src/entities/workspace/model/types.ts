import type {ProjectId, SessionId} from "@/shared/types/agent-types";

export interface Workspace {
  id: string;
  projectId: ProjectId | string;
  activeSessionId?: SessionId | string;
  name: string;
}
