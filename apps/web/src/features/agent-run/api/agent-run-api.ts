import {requestJson} from "@/shared/api/http-client";

export interface StartAgentRunRequest {
  prompt: string;
  workspaceId: string;
}

export interface StartAgentRunResponse {
  runId: string;
}

export function startAgentRun(request: StartAgentRunRequest) {
  return requestJson<StartAgentRunResponse>("/agent/runs", {
    body: JSON.stringify(request),
    method: "POST",
  });
}
