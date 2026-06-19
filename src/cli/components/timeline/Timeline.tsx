import {Box, Text} from "ink";
import type {CliTimelineItem} from "../../state/timeline.js";
import {icons, theme} from "../../utils/theme.js";
import {CommandHelp} from "../chrome/CommandHelp.js";
import {TimelineItem} from "./TimelineItem.js";

type TimelineProps = {
  items: CliTimelineItem[];
  showHelp: boolean;
  debug: boolean;
  width: number;
};

export function Timeline({items, showHelp, debug, width}: TimelineProps) {
  const visibleItems = debug ? items : items.filter((item) => item.kind !== "trace");
  const itemCount = visibleItems.length + (showHelp ? 1 : 0);

  return (
    <Box flexDirection="column" marginBottom={itemCount > 0 ? 1 : 0}>
      {visibleItems.map((item, index) => (
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
            <TimelineItem item={item} debug={debug} width={Math.max(40, width - 4)} />
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
    if (item.tool.status === "error") {
      return icons.error;
    }

    if (item.tool.status === "success" || item.tool.status === "done") {
      return icons.done;
    }

    return icons.tool;
  }

  if (item.kind === "change_set") {
    return icons.file;
  }

  if (item.kind === "verification") {
    return icons.check;
  }

  if (item.kind === "trace") {
    return icons.trace;
  }

  return icons.image;
}

function getMarkerColor(item: CliTimelineItem): string {
  if (item.kind === "message") {
    return item.message.role === "error" ? theme.danger : theme.brand;
  }

  if (item.kind === "tool") {
    if (item.tool.status === "error") {
      return theme.danger;
    }

    if (item.tool.status === "success" || item.tool.status === "done") {
      return theme.success;
    }

    return theme.accent;
  }

  if (item.kind === "change_set") {
    return theme.success;
  }

  if (item.kind === "verification") {
    if (item.verification.status === "failed") {
      return theme.danger;
    }

    return item.verification.status === "passed" ? theme.success : theme.accent;
  }

  if (item.kind === "trace") {
    return theme.faint;
  }

  return theme.muted;
}
