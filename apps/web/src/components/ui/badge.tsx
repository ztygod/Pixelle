import type {ComponentProps} from "react";
import {cn} from "../../lib/utils";

export function Badge({className, ...props}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[#cdd8c6]",
        className,
      )}
      {...props}
    />
  );
}
