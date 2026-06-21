import type {ContextSection, ContextSource} from "./types.js";

/** Strategy used to order context sections. */
export interface ContextPriorityPolicy {
  priorityOf(section: ContextSection): number;
  compare(left: ContextSection, right: ContextSection): number;
}

/** Default priority policy with explicit priority taking precedence. */
export class DefaultContextPriorityPolicy implements ContextPriorityPolicy {
  priorityOf(section: ContextSection): number {
    return section.priority ?? priorityForSource(section.source);
  }

  compare(left: ContextSection, right: ContextSection): number {
    return this.priorityOf(right) - this.priorityOf(left);
  }
}

function priorityForSource(source: ContextSource | undefined): number {
  switch (source?.kind) {
    case "workspace":
      return 100;
    case "user":
      return 80;
    case "memory":
      return 60;
    case "provider":
      return 50;
    case "tool":
      return 40;
    case "file":
      return 30;
    case "system":
      return 20;
    default:
      return 0;
  }
}
