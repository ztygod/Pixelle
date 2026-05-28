import type {ProjectId} from "@pixelle/types";

export interface Project {
  id: ProjectId | string;
  name: string;
  rootPath?: string;
  branch?: string;
}
