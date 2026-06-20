import {WorkspaceScanner, type WorkspaceProfile} from "../../runtime/index.js";
import type {AgentRunState} from "./run-state.js";

/** Constructor options for workspace preparation and discovery. */
export type WorkspaceServiceOptions = {
  /** Root directory all workspace operations are scoped to. */
  workspaceRoot: string;
  /** Optional scanner override, primarily for tests or custom workspace discovery. */
  scanner?: WorkspaceScanner;
};

/** Prepares workspace metadata for a run and owns the workspace root boundary. */
export class WorkspaceService {
  private readonly scanner: WorkspaceScanner;

  /** Creates a workspace service with the default scanner when none is supplied. */
  constructor(private readonly options: WorkspaceServiceOptions) {
    this.scanner = options.scanner ?? new WorkspaceScanner();
  }

  /** Absolute or configured workspace root used by tools and verification. */
  get root(): string {
    return this.options.workspaceRoot;
  }

  /** Scans the workspace and stores the resulting profile on run state and context. */
  async prepare(run: AgentRunState): Promise<WorkspaceProfile> {
    const profile = await this.scanner.scan(this.root, run.input.signal);
    run.workspaceProfile = profile;
    run.context.workspaceProfile = profile;
    return profile;
  }
}

/** Creates the default workspace service. */
export function createWorkspaceService(
  options: WorkspaceServiceOptions,
): WorkspaceService {
  return new WorkspaceService(options);
}
