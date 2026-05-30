import {requestJson} from "@/shared/api/http-client";

export interface StartAgentExecutionRequest {
  prompt: string;
  workspaceId: string;
}

export interface StartAgentExecutionResponse {
  runId: string;
}

export function startAgentExecution(request: StartAgentExecutionRequest) {
  return requestJson<StartAgentExecutionResponse>("/agent/runs", {
    body: JSON.stringify(request),
    method: "POST",
  });
}
