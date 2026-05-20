import {Box, Text} from "ink";
import type {CliTimelineItem} from "../../state/timeline.js";
import {icons, theme} from "../../utils/theme.js";
import {TimelineItem} from "./TimelineItem.js";

type TimelineProps = {
  items: CliTimelineItem[];
};

export function Timeline({items}: TimelineProps) {
  return (
    <Box flexDirection="column" marginBottom={items.length > 0 ? 1 : 0}>
      {items.map((item, index) => (
        <Box key={item.key} flexDirection="row">
          <Box width={2} flexDirection="column" alignItems="center">
            <Text color={getMarkerColor(item)}>{getMarker(item)}</Text>
            {index < items.length - 1 ? (
              <Text color={theme.rail}>{icons.rail}</Text>
            ) : (
              <Text> </Text>
            )}
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <TimelineItem item={item} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function getMarker(item: CliTimelineItem): string {
  if (item.kind === "message") {
    if (item.message.role === "error") {
      return icons.error;
    }

    return item.message.role === "assistant" ? icons.assistant : icons.user;
  }

  if (item.kind === "tool") {
    return item.tool.status === "error" ? icons.error : icons.tool;
  }

  return icons.image;
}

function getMarkerColor(item: CliTimelineItem): string {
  if (item.kind === "message") {
    return item.message.role === "error" ? theme.danger : theme.brand;
  }

  if (item.kind === "tool") {
    return item.tool.status === "error" ? theme.danger : theme.accent;
  }

  return theme.muted;
}
