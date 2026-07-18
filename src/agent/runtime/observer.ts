import type {EventBus, PixelleEvent} from "../../events/index.js";
import type {VerificationResult, ChangeSet} from "../../runtime/index.js";
import type {ToolResult, ToolStreamChunk} from "../../tool/index.js";
import {createEventMetadata, emitAgentEvent} from "../runtime-utils.js";
import type {AgentModelResponse, AgentToolCall, RunInternalOptions} from "../types.js";
import type {AgentRunState} from "./run-state.js";

/** Constructor options for the event-backed default observer. */
export type AgentObserverOptions = {
  /** Event bus that receives public runtime, conversation, tool, and change events. */
  eventBus: EventBus<PixelleEvent>;
};

/** Emits public agent lifecycle events while hiding module implementation details. */
export class AgentObserver {
  /** Creates an observer that publishes to the supplied event bus. */
  constructor(private readonly options: AgentObserverOptions) {}

  /** Event bus used by this observer; exposed for compatibility and tests. */
  get eventBus(): EventBus<PixelleEvent> {
    return this.options.eventBus;
  }

  /** Emits the standard session, status, user-message, and task-start events. */
  runStarted(run: AgentRunState): void {
    const metadata = this.metadata(run);
    this.emit(run, {type: "runtime.session_started", sessionId: run.sessionId, metadata});
    this.emit(run, {type: "runtime.status_changed", status: "running", metadata});
    this.emit(run, {
      type: "conversation.user_message",
      content: run.input.prompt,
      metadata,
    });
    this.emit(run, {
      type: "task.started",
      taskId: run.task.id,
      prompt: run.input.prompt,
      metadata,
    });
  }

  /** Emits the assistant stage for the current model/tool loop iteration. */
  assistantStage(run: AgentRunState): void {
    this.emit(run, {
      type: "conversation.assistant_stage",
      messageId: run.runId,
      stage: run.iteration === 1 ? "thinking" : "executing",
      metadata: this.metadata(run),
    });
  }

  /** Emits a streamed assistant content delta from the model runtime. */
  assistantDelta(run: AgentRunState, delta: string): void {
    this.emit(run, {
      type: "conversation.assistant_delta",
      messageId: run.runId,
      delta,
      stage: "thinking",
      metadata: this.metadata(run),
    });
  }

  /** Emits the runtime context-built event with an estimated token count. */
  contextBuilt(run: AgentRunState, tokenEstimate: number): void {
    this.emit(run, {
      type: "runtime.context_built",
      tokenEstimate,
      metadata: this.metadata(run),
    });
  }

  /** Emits the public tool-started event for a model-requested tool call. */
  toolStarted(run: AgentRunState, call: AgentToolCall): void {
    this.emit(run, {
      type: "tool.call_started",
      id: call.id,
      name: call.name,
      input: call.arguments,
      status: "running",
      metadata: this.metadata(run),
    });
  }

  /** Emits incremental output produced while a tool is running. */
  toolStreamed(run: AgentRunState, call: AgentToolCall, stream: ToolStreamChunk): void {
    this.emit(run, {
      type: "tool.call_stream",
      id: call.id,
      name: call.name,
      stream,
      metadata: this.metadata(run),
    });
  }

  /** Emits a public completed or failed tool event after middleware finalizes the result. */
  toolCompleted(run: AgentRunState, call: AgentToolCall, result: ToolResult): void {
    if (result.ok) {
      this.emit(run, {
        type: "tool.call_completed",
        id: call.id,
        name: call.name,
        result,
        output: result.data,
        summary: result.message,
        display: result.display,
        metadata: this.metadata(run),
      });
      return;
    }

    this.emit(run, {
      type: "tool.call_failed",
      id: call.id,
      name: call.name,
      result,
      error: result.message,
      code: result.code,
      data: result.data,
      display: result.display,
      metadata: this.metadata(run),
    });
  }

  /** Emits change-set created and applied events for a checkpointed set of edits. */
  changeSetApplied(
    run: AgentRunState,
    changeSet: ChangeSet,
    checkpointPath?: string,
  ): void {
    const files = changeSet.files.map((file) => file.path);
    const metadata = this.metadata(run);
    this.emit(run, {type: "change_set.created", id: changeSet.id, files, metadata});
    this.emit(run, {
      type: "change_set.applied",
      id: changeSet.id,
      files,
      changes: changeSet.files,
      checkpointPath,
      metadata,
    });
  }

  /** Emits the rollback-started event for one change set. */
  changeSetRollbackStarted(run: AgentRunState, changeSet: ChangeSet): void {
    this.emit(run, {
      type: "change_set.rollback_started",
      id: changeSet.id,
      metadata: this.metadata(run),
    });
  }

  /** Emits the rollback-completed event for one change set. */
  changeSetRollbackCompleted(run: AgentRunState, changeSet: ChangeSet): void {
    this.emit(run, {
      type: "change_set.rollback_completed",
      id: changeSet.id,
      metadata: this.metadata(run),
    });
  }

  /** Emits verification-started with the selected command list. */
  verificationStarted(run: AgentRunState, commands: readonly string[]): void {
    this.emit(run, {
      type: "verification.started",
      commands,
      metadata: this.metadata(run),
    });
  }

  /** Emits verification-completed for one verification batch. */
  verificationCompleted(
    run: AgentRunState,
    results: readonly VerificationResult[],
  ): void {
    this.emit(run, {
      type: "verification.completed",
      passed: results.every((result) => result.passed),
      commands: results.map((result) => result.command),
      metadata: this.metadata(run),
    });
  }

  /** Emits normal run completion and final session status events. */
  runCompleted(run: AgentRunState): void {
    const metadata = this.metadata(run);
    this.emit(run, {
      type: "conversation.assistant_done",
      messageId: run.runId,
      metadata,
    });
    this.emit(run, {
      type: "runtime.status_changed",
      status: run.stopReason === "completed" ? "complete" : "waiting",
      detail: run.stopReason,
      metadata,
    });
    this.emit(run, {type: "runtime.session_stopped", sessionId: run.sessionId, metadata});
  }

  /** Emits failure status and session shutdown events for unexpected run errors. */
  runFailed(run: AgentRunState, error: unknown): void {
    const metadata = this.metadata(run);
    this.emit(run, {
      type: "runtime.error",
      message: error instanceof Error ? error.message : "Agent run failed.",
      detail: error,
      metadata,
    });
    this.emit(run, {
      type: "runtime.status_changed",
      status: "error",
      detail: run.stopReason,
      metadata,
    });
    this.emit(run, {type: "runtime.session_stopped", sessionId: run.sessionId, metadata});
  }

  /** Emits exactly one terminal event sequence based on the final stop reason. */
  runTerminated(run: AgentRunState): void {
    if (run.stopReason === "error") {
      this.runFailed(run, run.error);
      return;
    }

    this.runCompleted(run);
  }

  /** Hook for future model-completed observer behavior. */
  modelCompleted(_run: AgentRunState, _response: AgentModelResponse): void {}

  /** Builds shared event metadata for all events emitted during a run. */
  metadata(run: AgentRunState): Record<string, unknown> {
    return createEventMetadata(run.input, run.sessionId, run.traceId);
  }

  private emit(run: AgentRunState, event: PixelleEvent): void {
    try {
      emitAgentEvent(
        this.options.eventBus,
        event,
        run.internalOptions as RunInternalOptions,
      );
    } catch (error) {
      run.recordFinalizationIssue("observer", error);
    }
  }
}

/** Creates the default event-backed observer. */
export function createAgentObserver(options: AgentObserverOptions): AgentObserver {
  return new AgentObserver(options);
}
