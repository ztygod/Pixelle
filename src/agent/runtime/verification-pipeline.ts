import {Verifier, type VerificationResult} from "../../runtime/index.js";
import type {AgentRuntimeConfig} from "../types.js";
import type {ChangeRuntime} from "./change-runtime.js";
import type {ContextManager} from "./context-manager.js";
import type {ModelRuntime} from "./model-runtime.js";
import type {AgentObserver} from "./observer.js";
import type {RuntimePolicy} from "./policy.js";
import type {AgentRunState} from "./run-state.js";
import type {ToolRuntime} from "./tool-runtime.js";
import type {WorkspaceService} from "./workspace-service.js";

/** Dependencies used to verify a run and optionally ask the model to repair it. */
export type VerificationPipelineOptions = {
  /** Normalized config for verification defaults and repair limits. */
  config: AgentRuntimeConfig;
  /** Workspace service that supplies the verification working directory. */
  workspace: WorkspaceService;
  /** Runtime policy used by the default verifier. */
  policy: RuntimePolicy;
  /** Tool runtime used during repair attempts. */
  tools: ToolRuntime;
  /** Model runtime used to generate repair responses. */
  model: ModelRuntime;
  /** Context manager used to append repair prompts and responses. */
  context: ContextManager;
  /** Change runtime used to checkpoint edits made during repair. */
  changes: ChangeRuntime;
  /** Observer used to emit verification lifecycle events. */
  observer: AgentObserver;
  /** Optional verifier override. */
  verifier?: Verifier;
};

/** Runs verification commands and performs bounded model/tool repair attempts. */
export class VerificationPipeline {
  private readonly verifier: Verifier;

  /** Creates a verification pipeline with a policy-backed default verifier. */
  constructor(private readonly options: VerificationPipelineOptions) {
    this.verifier = options.verifier ?? new Verifier(options.policy.commandPolicy);
  }

  /** Verifies the run, attempts repairs on failures, and updates the final stop reason. */
  async verifyAndRepair(run: AgentRunState, maxIterations: number): Promise<void> {
    if (!this.shouldVerify(run) || !run.workspaceProfile) {
      return;
    }

    run.task.status = "verifying";
    const commands = this.selectCommands(run);
    this.options.observer.verificationStarted(run, commands);
    const initialResults = await this.verify(run);
    run.verification.push(...initialResults);
    this.options.observer.verificationCompleted(run, initialResults);

    let failedVerification = run.verification.find((result) => !result.passed);
    const maxRepairAttempts =
      run.input.maxRepairAttempts ?? this.options.config.runtime.maxRepairAttempts;

    for (
      let repairAttempt = 1;
      failedVerification && repairAttempt <= maxRepairAttempts;
      repairAttempt += 1
    ) {
      if (!run.canContinue(maxIterations)) {
        break;
      }

      run.task.status = "repairing";
      this.options.context.appendRepairPrompt(
        run,
        buildRepairPrompt(failedVerification, repairAttempt),
      );
      run.nextIteration();
      this.options.observer.assistantStage(run);
      const response = await this.options.model.generate(
        await this.options.context.buildModelRequest(run, this.options.tools.schemas()),
        run,
      );
      this.options.context.appendAssistantResponse(run, response);
      const toolResults = await this.options.tools.execute(
        run,
        response.toolCalls.map((toolCall) => ({...toolCall, iteration: run.iteration})),
      );
      this.options.context.appendToolResults(run, toolResults);
      await this.options.changes.checkpoint(run);

      const repairResults = await this.verify(run);
      run.verification.push(...repairResults);
      this.options.observer.verificationCompleted(run, repairResults);
      failedVerification = repairResults.find((result) => !result.passed);
    }

    if (failedVerification) {
      run.stopReason = "error";
      run.content =
        `${run.content}\n\nVerification failed: ${failedVerification.command}`.trim();
    } else {
      run.stopReason = "completed";
    }
  }

  private shouldVerify(run: AgentRunState): boolean {
    return (
      run.input.verification?.enabled ??
      this.options.config.verification?.enabled ??
      run.input.mode !== "ask"
    );
  }

  private selectCommands(run: AgentRunState): string[] {
    if (!run.workspaceProfile) {
      return [];
    }

    return this.verifier.selectCommands(
      run.workspaceProfile,
      run.input.verification?.commands?.length
        ? run.input.verification.commands
        : this.options.config.verification?.commands,
    );
  }

  private verify(run: AgentRunState): Promise<VerificationResult[]> {
    if (!run.workspaceProfile) {
      return Promise.resolve([]);
    }

    return this.verifier.verify(this.options.workspace.root, run.workspaceProfile, {
      commands: run.input.verification?.commands?.length
        ? run.input.verification.commands
        : this.options.config.verification?.commands,
      signal: run.input.signal,
    });
  }
}

/** Creates the default verification pipeline. */
export function createVerificationPipeline(
  options: VerificationPipelineOptions,
): VerificationPipeline {
  return new VerificationPipeline(options);
}

/** Builds the user message that asks the model to repair one failed command. */
function buildRepairPrompt(failure: VerificationResult, repairAttempt: number): string {
  const output = [failure.stderr, failure.stdout].filter(Boolean).join("\n\n");

  return [
    `Verification failed on repair attempt ${repairAttempt}.`,
    `Command: ${failure.command}`,
    `Exit code: ${failure.exitCode ?? "none"}`,
    "Fix the issue using the available tools, then stop when the change is ready for verification.",
    "Verification output:",
    output.slice(0, 12_000),
  ].join("\n\n");
}
