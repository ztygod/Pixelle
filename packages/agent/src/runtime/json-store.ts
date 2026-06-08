import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

import type {ChangeSet, CheckpointStore, ExecutionTrace, TraceStore} from "./types.js";

export class JsonTraceStore implements TraceStore {
  readonly tracePath: string;
  private trace: ExecutionTrace | undefined;

  constructor(workspaceRoot: string, runId: string) {
    this.tracePath = path.join(workspaceRoot, ".pixelle", "runs", `${runId}.json`);
  }

  async start(trace: ExecutionTrace): Promise<void> {
    this.trace = trace;
    await this.persist();
  }

  async update(mutator: (trace: ExecutionTrace) => void): Promise<void> {
    if (!this.trace) {
      return;
    }

    mutator(this.trace);
    this.trace.updatedAt = Date.now();
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.trace) {
      return;
    }

    await mkdir(path.dirname(this.tracePath), {recursive: true});
    await writeFile(this.tracePath, `${JSON.stringify(this.trace, null, 2)}\n`, "utf8");
  }
}

export class JsonCheckpointStore implements CheckpointStore {
  readonly checkpointRoot: string;

  constructor(workspaceRoot: string, runId: string) {
    this.checkpointRoot = path.join(workspaceRoot, ".pixelle", "checkpoints", runId);
  }

  async save(changeSet: ChangeSet): Promise<string> {
    const checkpointPath = path.join(this.checkpointRoot, `${changeSet.id}.json`);

    await mkdir(path.dirname(checkpointPath), {recursive: true});
    await writeFile(checkpointPath, `${JSON.stringify(changeSet, null, 2)}\n`, "utf8");

    return checkpointPath;
  }
}

