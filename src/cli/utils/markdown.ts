export type MarkdownBlock =
  | {
      type: "heading";
      level: number;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: string[];
    }
  | {
      type: "quote";
      text: string;
    }
  | {
      type: "hr";
    }
  | {
      type: "table";
      rows: string[][];
    }
  | {
      type: "code";
      language?: string;
      code: string;
      closed: boolean;
    };

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\S+)?\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      const closed = index < lines.length;
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language: fence[1],
        code: codeLines.join("\n"),
        closed,
      });
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push({type: "hr"});
      index += 1;
      continue;
    }

    if (looksLikeTableLine(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && looksLikeTableLine(lines[index] ?? "")) {
        const current = lines[index] ?? "";
        if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(current)) {
          tableLines.push(current);
        }
        index += 1;
      }
      blocks.push({
        type: "table",
        rows: tableLines.map(parseTableRow).filter((row) => row.length > 0),
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({type: "quote", text: quoteLines.join("\n")});
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const item = orderedList
          ? current.match(/^\s*\d+[.)]\s+(.+)$/)
          : current.match(/^\s*[-*]\s+(.+)$/);
        if (!item) {
          break;
        }
        items.push(item[1]);
        index += 1;
      }
      blocks.push({type: "list", ordered: orderedList, items});
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (
        current.trim() === "" ||
        /^```/.test(current) ||
        /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(current) ||
        looksLikeTableLine(current) ||
        /^(#{1,6})\s+/.test(current) ||
        /^>\s?/.test(current) ||
        /^\s*[-*]\s+/.test(current) ||
        /^\s*\d+[.)]\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    blocks.push({type: "paragraph", text: paragraphLines.join(" ")});
  }

  return blocks;
}

function looksLikeTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes("|") && trimmed.split("|").length >= 3;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}
