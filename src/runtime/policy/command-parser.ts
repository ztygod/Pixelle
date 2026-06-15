import type {ParsedCommand} from "./types.js";

const CONTROL_OPERATORS = ["&&", "||", ";"];

/**
 * Extracts enough shell structure for safety decisions without attempting to
 * emulate a real shell parser.
 */
export function parseCommand(command: string): ParsedCommand {
  const normalized = command.trim();
  const hasCommandSubstitution = /\$\(|`/.test(normalized);
  const hasControlOperator = CONTROL_OPERATORS.some((operator) =>
    normalized.includes(operator),
  );
  const hasPipe = containsUnquoted(normalized, "|");
  const hasRedirection = /(^|\s)(?:\d?>&?\d?|\d?>>?|<)(?=\s|\S)/.test(normalized);
  const segments = splitSegments(normalized);
  const [executable, ...args] = tokenize(segments[0] ?? "");

  return {
    raw: command,
    normalized,
    executable: executable ? executable.toLowerCase() : undefined,
    args,
    hasControlOperator,
    hasPipe,
    hasRedirection,
    hasCommandSubstitution,
    segments,
  };
}

/** Tokenizes one command segment with simple quote and escape awareness. */
export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      current += char;
      continue;
    }

    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = undefined;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function splitSegments(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const next = command[index + 1];

    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      current += char;
      continue;
    }

    if (char === quote) {
      quote = undefined;
      current += char;
      continue;
    }

    if (!quote && char === "&" && next === "&") {
      pushSegment(segments, current);
      current = "";
      index += 1;
      continue;
    }

    if (!quote && char === "|" && next === "|") {
      pushSegment(segments, current);
      current = "";
      index += 1;
      continue;
    }

    if (!quote && (char === ";" || char === "|")) {
      pushSegment(segments, current);
      current = "";
      continue;
    }

    current += char;
  }

  pushSegment(segments, current);

  return segments;
}

function pushSegment(segments: string[], value: string): void {
  const segment = value.trim();
  if (segment) {
    segments.push(segment);
  }
}

function containsUnquoted(value: string, needle: string): boolean {
  let quote: "'" | '"' | undefined;

  for (const char of value) {
    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = undefined;
      continue;
    }

    if (!quote && char === needle) {
      return true;
    }
  }

  return false;
}
