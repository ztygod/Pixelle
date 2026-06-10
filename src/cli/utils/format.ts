let nextId = 0;

export function createId(prefix = "id"): string {
  nextId += 1;
  return `${prefix}_${Date.now().toString(36)}_${nextId.toString(36)}`;
}

export function clampWidth(width: number | undefined): number {
  if (!width || Number.isNaN(width)) {
    return 80;
  }

  return Math.max(40, Math.min(width, 140));
}

export function formatUnknown(value: unknown, maxLength = 120): string {
  const raw = stringifyUnknown(value);
  if (raw.length <= maxLength) {
    return raw;
  }

  return `${raw.slice(0, Math.max(0, maxLength - 1))}...`;
}

export function hasLongDetail(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }

  return stringifyUnknown(value).length > 80;
}

export function formatTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return "--:--:--";
  }

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
