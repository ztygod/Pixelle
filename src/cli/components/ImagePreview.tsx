import {Box, Text} from "ink";
import type {ImagePreviewState} from "../types/messages.js";
import {getImagePreviewLabel} from "../utils/image.js";

type ImagePreviewProps = {
  image: ImagePreviewState;
};

export function ImagePreview({image}: ImagePreviewProps) {
  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column">
      <Text bold color="magenta">
        Image Preview
      </Text>
      <Text>{image.path}</Text>
      {image.alt ? <Text color="gray">{image.alt}</Text> : null}
      <Text color="gray">{getImagePreviewLabel(image.path)}</Text>
    </Box>
  );
}
