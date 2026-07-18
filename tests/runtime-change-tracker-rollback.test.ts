import {mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {ChangeTracker} from "../src/runtime/index.js";

describe("ChangeTracker run-level rollback", () => {
  it("restores the original content after multiple checkpoints", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "pixelle-change-tracker-"));
    const filePath = join(workspaceRoot, "example.ts");
    await writeFile(filePath, "A", "utf8");
    const tracker = new ChangeTracker({runId: "run", workspaceRoot});

    await tracker.writeFile("example.ts", "B");
    await tracker.checkpoint();
    await tracker.writeFile("example.ts", "C");
    await tracker.checkpoint();
    await tracker.writeFile("example.ts", "D");

    const result = await tracker.rollbackAll();

    expect(result).toMatchObject({status: "completed", restoredFiles: ["example.ts"]});
    expect(await readFile(filePath, "utf8")).toBe("A");
  });

  it("reports a conflict instead of overwriting an external modification", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "pixelle-change-tracker-"));
    const filePath = join(workspaceRoot, "example.ts");
    await writeFile(filePath, "A", "utf8");
    const tracker = new ChangeTracker({runId: "run", workspaceRoot});

    await tracker.writeFile("example.ts", "B");
    await writeFile(filePath, "external", "utf8");
    const result = await tracker.rollbackAll();

    expect(result.status).toBe("failed");
    expect(result.conflicts[0]).toMatchObject({path: "example.ts"});
    expect(await readFile(filePath, "utf8")).toBe("external");
  });
});
