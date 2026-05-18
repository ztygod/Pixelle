export function clampWidth(width: number | undefined, fallback = 80): number {
  if (!width || Number.isNaN(width)) {
    return fallback;
  }

  return Math.max(24, width);
}

export function wrapText(text: string, width: number): string {
  if (width <= 0) {
    return text;
  }

  return text
    .split("\n")
    .map((line) => wrapLine(line, width))
    .join("\n");
}

function wrapLine(line: string, width: number): string {
  if (line.length <= width) {
    return line;
  }

  const chunks: string[] = [];
  let cursor = line;

  while (cursor.length > width) {
    let breakAt = cursor.lastIndexOf(" ", width);
    if (breakAt <= 0) {
      breakAt = width;
    }

    chunks.push(cursor.slice(0, breakAt));
    cursor = cursor.slice(breakAt).trimStart();
  }

  if (cursor.length > 0) {
    chunks.push(cursor);
  }

  return chunks.join("\n");
}
