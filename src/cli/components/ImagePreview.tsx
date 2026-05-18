import {Box, Text} from "ink";
import type {ImagePreviewState} from "../events/types.js";
import {getImagePreviewLabel} from "../utils/image.js";
import {icons, theme} from "../utils/theme.js";

type ImagePreviewProps = {
  image: ImagePreviewState;
};

export function ImagePreview({image}: ImagePreviewProps) {
  return (
    <Box borderStyle="single" borderColor={theme.border} paddingX={1} flexDirection="column">
      <Text color={theme.primary}>
        {icons.image} Image Preview
      </Text>
      <Text>{image.path}</Text>
      {image.alt ? <Text color={theme.muted}>{image.alt}</Text> : null}
      <Text color={theme.muted}>{getImagePreviewLabel(image.path)}</Text>
    </Box>
  );
}
