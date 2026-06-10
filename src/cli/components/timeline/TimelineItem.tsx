import type {CliTimelineItem} from "../../state/timeline.js";
import {ErrorBlock} from "./ErrorBlock.js";
import {FileChangeCard} from "./FileChangeCard.js";
import {ImagePreview} from "./ImagePreview.js";
import {MessageList} from "./MessageList.js";
import {RuntimeNote} from "./RuntimeNote.js";
import {ToolStatus} from "./ToolStatus.js";

type TimelineItemProps = {
  item: CliTimelineItem;
  debug: boolean;
  width: number;
};

export function TimelineItem({item, debug, width}: TimelineItemProps) {
  if (item.kind === "message") {
    return item.message.role === "error" ? (
      <ErrorBlock message={item.message.content} />
    ) : (
      <MessageList messages={[item.message]} width={width} />
    );
  }

  if (item.kind === "tool") {
    return <ToolStatus tool={item.tool} debug={debug} />;
  }

  if (item.kind === "change_set") {
    return <FileChangeCard changeSet={item.changeSet} debug={debug} />;
  }

  if (item.kind === "verification") {
    return (
      <RuntimeNote kind="verification" verification={item.verification} debug={debug} />
    );
  }

  if (item.kind === "trace") {
    return <RuntimeNote kind="trace" trace={item.trace} debug={debug} />;
  }

  return <ImagePreview image={item.image} />;
}
