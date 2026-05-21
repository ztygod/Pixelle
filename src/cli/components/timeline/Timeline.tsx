import {Box, Text} from "ink";
import type {CliTimelineItem} from "../../state/timeline.js";
import {icons, theme} from "../../utils/theme.js";
import {CommandHelp} from "../chrome/CommandHelp.js";
import {TimelineItem} from "./TimelineItem.js";

type TimelineProps = {
  items: CliTimelineItem[];
  showHelp: boolean;
};

export function Timeline({items, showHelp}: TimelineProps) {
  const itemCount = items.length + (showHelp ? 1 : 0);

  return (
    <Box flexDirection="column" marginBottom={itemCount > 0 ? 1 : 0}>
      {items.map((item, index) => (
        <Box key={item.key} flexDirection="row">
          <Box width={2} flexDirection="column" alignItems="center">
            <Text color={getMarkerColor(item)}>{getMarker(item)}</Text>
            {index < itemCount - 1 ? (
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
      {showHelp ? (
        <Box key="command-help" flexDirection="row">
          <Box width={2} flexDirection="column" alignItems="center">
            <Text color={theme.accent}>{icons.tool}</Text>
            <Text> </Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <CommandHelp />
          </Box>
        </Box>
      ) : null}
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
