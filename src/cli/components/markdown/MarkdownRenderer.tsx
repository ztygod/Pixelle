import {MessageMarkdown} from "./MessageMarkdown.js";

type MarkdownRendererProps = {
  content: string;
  revealCode?: boolean;
  width?: number;
};

export function MarkdownRenderer({
  content,
  revealCode = false,
  width = 80,
}: MarkdownRendererProps) {
  return <MessageMarkdown content={content} streaming={revealCode} width={width} />;
}
