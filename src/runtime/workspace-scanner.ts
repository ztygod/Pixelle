import {access, readFile} from "node:fs/promises";
import path from "node:path";

import {listWorkspaceFiles} from "../tool/fs/glob-tool.js";
import type {WorkspaceProfile} from "./types.js";

export class WorkspaceScanner {
  async scan(workspaceRoot: string, signal?: AbortSignal): Promise<WorkspaceProfile> {
    const projectFiles = await listWorkspaceFiles(workspaceRoot, 500, undefined, signal);
    const packageJson = await readJsonFile(path.join(workspaceRoot, "package.json"));
    const scripts = readScripts(packageJson);

    return {
      root: workspaceRoot,
      packageManager: await detectPackageManager(workspaceRoot),
      scripts,
      projectFiles,
      detectedFrameworks: detectFrameworks(packageJson, projectFiles),
    };
  }
}

async function detectPackageManager(
  workspaceRoot: string,
): Promise<WorkspaceProfile["packageManager"]> {
  if (await exists(path.join(workspaceRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (await exists(path.join(workspaceRoot, "yarn.lock"))) {
    return "yarn";
  }
  if (await exists(path.join(workspaceRoot, "package-lock.json"))) {
    return "npm";
  }

  return undefined;
}

function readScripts(value: unknown): Record<string, string> {
  if (!isRecord(value) || !isRecord(value.scripts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value.scripts).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  );
}

function detectFrameworks(packageJson: unknown, projectFiles: string[]): string[] {
  const dependencies = new Set<string>();
  if (isRecord(packageJson)) {
    for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
      const deps = packageJson[key];
      if (!isRecord(deps)) {
        continue;
      }
      for (const dependency of Object.keys(deps)) {
        dependencies.add(dependency);
      }
    }
  }

  const frameworks = new Set<string>();
  for (const candidate of ["react", "vite", "next", "typescript", "fastify"]) {
    if (dependencies.has(candidate)) {
      frameworks.add(candidate);
    }
  }
  if (projectFiles.some((file) => file.endsWith("tsconfig.json"))) {
    frameworks.add("typescript");
  }

  return [...frameworks];
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

