import {Box, Text} from "ink";
import type {ImagePreviewState} from "../../types.js";
import {getImagePreviewLabel} from "../../utils/image.js";
import {theme} from "../../utils/theme.js";

type ImagePreviewProps = {
  image: ImagePreviewState;
};

export function ImagePreview({image}: ImagePreviewProps) {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text>
        <Text color={theme.brand}>image</Text>
        <Text color={theme.muted}> / </Text>
        <Text>{image.path}</Text>
      </Text>
      <Box paddingLeft={2} flexDirection="column">
        {image.alt ? <Text color={theme.muted}>{image.alt}</Text> : null}
        <Text color={theme.muted}>{getImagePreviewLabel(image.path)}</Text>
      </Box>
    </Box>
  );
}
