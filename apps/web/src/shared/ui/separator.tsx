import type {ComponentProps} from "react";
import {cn} from "@/shared/lib/cn";

export function Separator({className, ...props}: ComponentProps<"div">) {
  return (
    <div
      className={cn("h-px w-full bg-[var(--color-border-subtle)]", className)}
      role="separator"
      {...props}
    />
  );
}
