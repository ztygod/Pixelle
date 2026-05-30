import {requestJson} from "@/shared/api/http-client";
import type {ProjectFile} from "@/entities/file/model/types";

export function fetchWorkspaceFiles(workspaceId: string) {
  return requestJson<ProjectFile[]>(`/workspaces/${workspaceId}/files`);
}
