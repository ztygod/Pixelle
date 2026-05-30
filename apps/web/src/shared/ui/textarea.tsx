import type {ComponentProps} from "react";
import {cn} from "@/shared/lib/cn";

export function Textarea({className, ...props}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none border-0 bg-transparent text-sm leading-6 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-disabled)]",
        className,
      )}
      {...props}
    />
  );
}
