import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

export type GitSummary = {
  branch: string;
  status: "clean" | "modified" | "unknown";
};

export async function readGitSummary(cwd: string): Promise<GitSummary> {
  try {
    const [{stdout: branchStdout}, {stdout: statusStdout}] = await Promise.all([
      execFileAsync("git", ["branch", "--show-current"], {cwd}),
      execFileAsync("git", ["status", "--porcelain"], {cwd}),
    ]);

    return {
      branch: branchStdout.trim() || "detached",
      status: statusStdout.trim() ? "modified" : "clean",
    };
  } catch {
    return {
      branch: "unknown",
      status: "unknown",
    };
  }
}
