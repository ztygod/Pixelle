import {requestJson} from "@/shared/api/http-client";
import type {Workspace} from "@/entities/workspace/model/types";

export function fetchWorkspace(workspaceId: string) {
  return requestJson<Workspace>(`/workspaces/${workspaceId}`);
}
