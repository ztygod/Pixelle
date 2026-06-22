import type {ContextPriorityPolicy} from "../budget/priority-policy.js";
import type {ContextSection} from "../types.js";

/** Mutable registry for normalizing, deduping, and ordering context sections. */
export class ContextRegistry {
  private sections: ContextSection[] = [];

  add(section: ContextSection): this {
    this.sections.push(section);
    return this;
  }

  addMany(sections: readonly ContextSection[]): this {
    this.sections.push(...sections);
    return this;
  }

  normalize(): this {
    this.sections = this.sections
      .map((section) => ({...section, content: section.content.trim()}))
      .filter((section) => section.content.length > 0);
    return this;
  }

  dedupe(): this {
    const seen = new Set<string>();
    const deduped: ContextSection[] = [];

    for (let index = this.sections.length - 1; index >= 0; index -= 1) {
      const section = this.sections[index];
      if (!section) {
        continue;
      }
      const key = section.replaceKey ?? section.id;

      if (key) {
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
      }

      deduped.push(section);
    }

    this.sections = deduped.reverse();
    return this;
  }

  sort(policy: ContextPriorityPolicy): this {
    this.sections = this.sections
      .map((section, index) => ({section, index}))
      .sort((left, right) => {
        const priorityComparison = policy.compare(left.section, right.section);
        return priorityComparison || left.index - right.index;
      })
      .map((entry) => entry.section);
    return this;
  }

  getAll(): ContextSection[] {
    return [...this.sections];
  }
}
