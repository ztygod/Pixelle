import {Fragment} from "react";
import {Box, Text} from "ink";
import {parseMarkdown} from "../../utils/markdown.js";
import {theme} from "../../utils/theme.js";
import {CodeBlock} from "./CodeBlock.js";

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({content}: MarkdownRendererProps) {
  const blocks = parseMarkdown(content);

  return (
    <Box flexDirection="column">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Text key={index} bold color={block.level <= 2 ? theme.primary : theme.muted}>
                {block.text}
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
              <Box key={index} flexDirection="column">
                {block.items.map((item, itemIndex) => (
                  <InlineText
                    key={`${itemIndex}:${item}`}
                    prefix={block.ordered ? `${itemIndex + 1}. ` : "- "}
                    text={item}
                  />
                ))}
              </Box>
            );
          case "code":
            return <CodeBlock key={index} code={block.code} language={block.language} />;
        }
      })}
    </Box>
  );
}

function InlineText({text, prefix = ""}: {text: string; prefix?: string}) {
  const parts = text.split(/(`[^`]+`)/g);

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

        return <Fragment key={`${index}:${part}`}>{part}</Fragment>;
      })}
    </Text>
  );
}
