import {
  ChangeTracker,
  JsonCheckpointStore,
  type CheckpointStore,
} from "../../runtime/index.js";
import type {ToolFileWriter} from "../../tool/index.js";
import type {AgentRuntimeConfig} from "../types.js";
import type {AgentObserver} from "./observer.js";
import type {AgentRunState} from "./run-state.js";
import type {RuntimePolicy} from "./policy.js";
import type {WorkspaceService} from "./workspace-service.js";

/** Dependencies required to track, checkpoint, and roll back file changes. */
export type ChangeRuntimeOptions = {
  /** Normalized agent config used for checkpoint storage defaults. */
  config: AgentRuntimeConfig;
  /** Workspace service that supplies the workspace root. */
  workspace: WorkspaceService;
  /** Runtime policy dependency reserved for change safety decisions. */
  policy: RuntimePolicy;
  /** Observer used to emit change-set lifecycle events. */
  observer: AgentObserver;
  /** Optional checkpoint store override. */
  checkpointStore?: CheckpointStore;
};

/** Owns run-scoped change tracking, checkpoints, and rollback behavior. */
export class ChangeRuntime {
  private readonly trackers = new WeakMap<AgentRunState, ChangeTracker>();

  /** Creates a change runtime that lazily creates one ChangeTracker per run. */
  constructor(private readonly options: ChangeRuntimeOptions) {}

  /** Creates the run-scoped file writer and exposes it to tools through run context. */
  prepare(run: AgentRunState): ToolFileWriter {
    const tracker = new ChangeTracker({
      runId: run.runId,
      workspaceRoot: this.options.workspace.root,
      checkpointStore:
        this.options.checkpointStore ??
        new JsonCheckpointStore(
          this.options.config.trace?.directory ?? this.options.workspace.root,
          run.runId,
        ),
    });
    this.trackers.set(run, tracker);
    run.context.fileWriter = tracker;
    return tracker;
  }

  /** Persists the current dirty change set, updates run state, and emits events. */
  async checkpoint(run: AgentRunState): Promise<void> {
    const tracker = this.requireTracker(run);
    const checkpoint = await tracker.checkpoint();
    if (!checkpoint.changeSet) {
      return;
    }

    run.changes.push(checkpoint.changeSet);
    run.checkpointPath = checkpoint.path ?? run.checkpointPath;
    this.options.observer.changeSetApplied(run, checkpoint.changeSet, checkpoint.path);
  }

  /** Rolls back checkpointed changes in reverse order for a failed run. */
  async rollback(run: AgentRunState): Promise<void> {
    if (!run.changes.length) {
      return;
    }

    const tracker = this.requireTracker(run);
    run.task.status = "rolled_back";
    for (const changeSet of [...run.changes].reverse()) {
      this.options.observer.changeSetRollbackStarted(run, changeSet);
      await tracker.rollback(changeSet);
      this.options.observer.changeSetRollbackCompleted(run, changeSet);
    }
  }

  private requireTracker(run: AgentRunState): ChangeTracker {
    const tracker = this.trackers.get(run);
    if (!tracker) {
      throw new Error("ChangeRuntime was not prepared for this run.");
    }

    return tracker;
  }
}

/** Creates the default change runtime. */
export function createChangeRuntime(options: ChangeRuntimeOptions): ChangeRuntime {
  return new ChangeRuntime(options);
}
