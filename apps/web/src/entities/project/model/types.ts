import type {ProjectId} from "@/shared/types/agent-types";

export interface Project {
  id: ProjectId | string;
  name: string;
  rootPath?: string;
  branch?: string;
}
