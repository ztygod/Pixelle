import type {CliTimelineItem} from "../../state/timeline.js";
import {ErrorBlock} from "./ErrorBlock.js";
import {ImagePreview} from "./ImagePreview.js";
import {MessageList} from "./MessageList.js";
import {ToolStatus} from "./ToolStatus.js";

type TimelineItemProps = {
  item: CliTimelineItem;
};

export function TimelineItem({item}: TimelineItemProps) {
  if (item.kind === "message") {
    return item.message.role === "error" ? (
      <ErrorBlock message={item.message.content} />
    ) : (
      <MessageList messages={[item.message]} />
    );
  }

  if (item.kind === "tool") {
    return <ToolStatus tool={item.tool} />;
  }

  return <ImagePreview image={item.image} />;
}
