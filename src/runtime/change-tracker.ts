import {createHash, randomUUID} from "node:crypto";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";

import {resolveWorkspacePath} from "../workspace/path-safety.js";
import type {ChangeSet, ChangedFile, CheckpointStore} from "./types.js";

export type TrackedWriteResult = {
  path: string;
  bytesWritten: number;
};

export class ChangeTracker {
  private readonly files = new Map<string, ChangedFile>();
  private dirty = false;

  constructor(
    private readonly input: {
      runId: string;
      workspaceRoot: string;
      checkpointStore?: CheckpointStore;
    },
  ) {}

  async writeFile(relativePath: string, content: string): Promise<TrackedWriteResult> {
    const safePath = resolveWorkspacePath(this.input.workspaceRoot, relativePath);
    const existing = this.files.get(safePath.relativePath);
    const beforeContent =
      existing?.beforeContent ?? (await readExistingFile(safePath.absolutePath));

    await mkdir(path.dirname(safePath.absolutePath), {recursive: true});
    await writeFile(safePath.absolutePath, content, "utf8");

    const changedFile: ChangedFile = {
      path: safePath.relativePath,
      beforeHash: beforeContent === undefined ? undefined : hashText(beforeContent),
      afterHash: hashText(content),
      beforeContent,
      afterContent: content,
      status: existing?.status ?? (beforeContent === undefined ? "created" : "modified"),
    };
    this.files.set(safePath.relativePath, changedFile);
    this.dirty = true;

    return {
      path: safePath.relativePath,
      bytesWritten: Buffer.byteLength(content, "utf8"),
    };
  }

  createChangeSet(): ChangeSet | undefined {
    if (!this.files.size || !this.dirty) {
      return undefined;
    }

    return {
      id: randomUUID(),
      runId: this.input.runId,
      files: [...this.files.values()],
      createdAt: Date.now(),
    };
  }

  async checkpoint(): Promise<{changeSet?: ChangeSet; path?: string}> {
    const changeSet = this.createChangeSet();
    if (!changeSet) {
      return {};
    }
    this.dirty = false;

    return {
      changeSet,
      path: await this.input.checkpointStore?.save(changeSet),
    };
  }

  async rollback(changeSet: ChangeSet): Promise<void> {
    for (const file of [...changeSet.files].reverse()) {
      const safePath = resolveWorkspacePath(this.input.workspaceRoot, file.path);
      const currentContent = await readExistingFile(safePath.absolutePath);
      const currentHash = currentContent === undefined ? undefined : hashText(currentContent);

      if (currentHash !== file.afterHash) {
        throw new Error(
          `Cannot rollback "${file.path}" because it changed after the checkpoint was created.`,
        );
      }

      if (file.beforeContent === undefined) {
        await rm(safePath.absolutePath, {force: true});
        continue;
      }

      await mkdir(path.dirname(safePath.absolutePath), {recursive: true});
      await writeFile(safePath.absolutePath, file.beforeContent, "utf8");
    }
  }
}

async function readExistingFile(absolutePath: string): Promise<string | undefined> {
  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
