import {Box, Text} from "ink";
import type {UserInputBus} from "../adapters/event-bus.js";
import type {CliMessage, ImagePreviewState, ToolCallState} from "../types/messages.js";
import {ImagePreview} from "./ImagePreview.js";
import {InputBox} from "./InputBox.js";
import {MessageList} from "./MessageList.js";
import {StatusBar} from "./StatusBar.js";
import {ToolCallCard} from "./ToolCallCard.js";

type LayoutProps = {
  title: string;
  messages: CliMessage[];
  tools: ToolCallState[];
  images: ImagePreviewState[];
  userInputBus: UserInputBus;
  width: number;
  lastError?: string;
};

export function Layout({
  title,
  messages,
  tools,
  images,
  userInputBus,
  width,
  lastError,
}: LayoutProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="blue">
        {title}
      </Text>
      <Box flexDirection="column" marginY={1}>
        <MessageList messages={messages} />
      </Box>
      {tools.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {tools.map((tool) => (
            <ToolCallCard key={tool.id} tool={tool} />
          ))}
        </Box>
      ) : null}
      {images.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {images.map((image) => (
            <ImagePreview key={image.id} image={image} />
          ))}
        </Box>
      ) : null}
      <StatusBar tools={tools} width={width} lastError={lastError} />
      <InputBox userInputBus={userInputBus} />
    </Box>
  );
}
