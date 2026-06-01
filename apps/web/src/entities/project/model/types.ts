import type {ProjectId} from "@pixelle/agent";

export interface Project {
  id: ProjectId | string;
  name: string;
  rootPath?: string;
  branch?: string;
}
