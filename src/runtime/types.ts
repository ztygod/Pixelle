import type {
  AgentModelRequest,
  AgentModelResponse,
  AgentRunResult,
  AgentToolResult,
} from "../agent/types.js";
import type {PixelleEvent} from "../events/index.js";

export type TaskRunStatus =
  | "created"
  | "planning"
  | "executing"
  | "verifying"
  | "repairing"
  | "completed"
  | "failed"
  | "cancelled"
  | "rolled_back";

export type TaskStepStatus = "pending" | "running" | "completed" | "failed";

export type TaskStep = {
  id: string;
  title: string;
  status: TaskStepStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
};

export type TaskRun = {
  id: string;
  runId: string;
  status: TaskRunStatus;
  createdAt: number;
  updatedAt: number;
  steps: TaskStep[];
};

export type ChangedFileStatus = "created" | "modified" | "deleted";

export type ChangedFile = {
  path: string;
  beforeHash?: string;
  afterHash?: string;
  beforeContent?: string;
  afterContent?: string;
  status: ChangedFileStatus;
};

export type ChangeSet = {
  id: string;
  runId: string;
  files: ChangedFile[];
  createdAt: number;
};

export type RollbackResult = {
  status: "not_required" | "completed" | "partial" | "failed";
  restoredFiles: string[];
  conflicts: Array<{
    path: string;
    message: string;
  }>;
};

export type VerificationResult = {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  passed: boolean;
  timedOut: boolean;
};

export type WorkspaceProfile = {
  root: string;
  packageManager?: "pnpm" | "npm" | "yarn";
  scripts: Record<string, string>;
  projectFiles: string[];
  detectedFrameworks: string[];
};

export type AgentModelTrace = {
  request: AgentModelRequest;
  response?: AgentModelResponse;
  error?: string;
  createdAt: number;
};

export type ExecutionTrace = {
  runId: string;
  sessionId: string;
  traceId: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  events: PixelleEvent[];
  modelCalls: AgentModelTrace[];
  toolCalls: AgentToolResult[];
  changeSets: ChangeSet[];
  verificationResults: VerificationResult[];
  workspaceProfile?: WorkspaceProfile;
  finalResult?: Omit<AgentRunResult, "messages"> & {messageCount: number};
  error?: string;
};

export type TraceStore = {
  readonly tracePath?: string;
  start(trace: ExecutionTrace): Promise<void>;
  update(mutator: (trace: ExecutionTrace) => void): Promise<void>;
};

export type CheckpointStore = {
  readonly checkpointRoot?: string;
  save(changeSet: ChangeSet): Promise<string | undefined>;
};
