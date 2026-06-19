import {Fragment} from "react";
import {Box, Text} from "ink";

import {parseMarkdown} from "../../utils/markdown.js";
import {theme} from "../../utils/theme.js";
import {CodeBlock} from "./CodeBlock.js";

type MessageMarkdownProps = {
  content: string;
  streaming?: boolean;
  width: number;
};

export function MessageMarkdown({
  content,
  streaming = false,
  width,
}: MessageMarkdownProps) {
  const blocks = parseMarkdown(content);

  return (
    <Box flexDirection="column">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Text
                key={index}
                bold
                color={block.level <= 2 ? theme.primary : theme.muted}
              >
                {formatHeading(block.level, block.text)}
              </Text>
            );
          case "paragraph":
            return <InlineText key={index} text={block.text} />;
          case "quote":
            return (
              <Text key={index} color={theme.muted}>
                &gt; {block.text}
              </Text>
            );
          case "list":
            return (
              <Box key={index} flexDirection="column" marginY={1}>
                {block.items.map((item, itemIndex) => (
                  <InlineText
                    key={`${itemIndex}:${item}`}
                    prefix={block.ordered ? `${itemIndex + 1}. ` : "• "}
                    text={item}
                  />
                ))}
              </Box>
            );
          case "hr":
            return (
              <Text key={index} color={theme.rail}>
                {"─".repeat(Math.max(12, Math.min(width - 4, 72)))}
              </Text>
            );
          case "table":
            return (
              <Box key={index} flexDirection="column" marginY={1}>
                {block.rows.map((row, rowIndex) => (
                  <InlineText
                    key={`${rowIndex}:${row.join("|")}`}
                    prefix={rowIndex === 0 ? "• " : "  "}
                    text={row.join(" · ")}
                  />
                ))}
              </Box>
            );
          case "code":
            return (
              <CodeBlock
                key={index}
                code={block.code}
                language={block.language}
                streaming={streaming && !block.closed}
                closed={block.closed}
                width={width}
              />
            );
        }
      })}
    </Box>
  );
}

function InlineText({text, prefix = ""}: {text: string; prefix?: string}) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <Text>
      {prefix}
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={`${index}:${part}`} color={theme.accent}>
              {part.slice(1, -1)}
            </Text>
          );
        }

        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={`${index}:${part}`} bold>
              {part.slice(2, -2)}
            </Text>
          );
        }

        return <Fragment key={`${index}:${part}`}>{part}</Fragment>;
      })}
    </Text>
  );
}

function formatHeading(level: number, text: string): string {
  return level <= 2 ? text : `${"#".repeat(level)} ${text}`;
}
