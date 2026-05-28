import type {ProjectId, SessionId} from "@pixelle/types";

export interface Workspace {
  id: string;
  projectId: ProjectId | string;
  activeSessionId?: SessionId | string;
  name: string;
}
