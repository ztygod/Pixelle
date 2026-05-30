import type {ComponentProps} from "react";
import {cn} from "@/shared/lib/cn";

export function Badge({className, ...props}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}
