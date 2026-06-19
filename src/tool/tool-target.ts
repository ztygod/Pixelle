/** Derives a short human-readable object a tool call acts on. */
export function inferToolTarget(
  toolName: string,
  ...candidates: unknown[]
): string | undefined {
  for (const candidate of candidates) {
    const target = inferTargetFromValue(toolName, candidate);
    if (target) {
      return target;
    }
  }

  return undefined;
}

function inferTargetFromValue(toolName: string, value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const key of getTargetKeys(toolName)) {
    const target = getStringValue(record[key]);
    if (target) {
      return target;
    }
  }

  return undefined;
}

function getTargetKeys(toolName: string): readonly string[] {
  switch (toolName) {
    case "bash":
      return ["command", "title", "cwd"];
    case "read_file":
    case "write_file":
    case "edit_file":
      return ["path", "title"];
    case "grep":
      return ["pattern", "path", "title"];
    case "glob":
      return ["pattern", "path", "title"];
    case "web_fetch":
      return ["url", "finalUrl", "requestedUrl", "title"];
    default:
      return [
        "target",
        "path",
        "file",
        "directory",
        "command",
        "pattern",
        "query",
        "url",
        "title",
      ];
  }
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
