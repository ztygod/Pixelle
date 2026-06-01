import type {ProjectId, SessionId} from "@pixelle/agent";

export interface Workspace {
  id: string;
  projectId: ProjectId | string;
  activeSessionId?: SessionId | string;
  name: string;
}
