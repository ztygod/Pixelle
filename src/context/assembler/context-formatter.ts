import type {ContextSection} from "../types.js";

/** Returns a formatted section string, or an empty string for blank content. */
export function formatContextSection(section: ContextSection): string {
  const content = section.content.trim();

  if (!content) {
    return "";
  }

  return section.title ? `## ${section.title}\n${content}` : content;
}
