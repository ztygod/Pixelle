import type {ComponentProps} from "react";
import {cn} from "@/shared/lib/cn";

export function Separator({className, ...props}: ComponentProps<"div">) {
  return (
    <div
      className={cn("h-px w-full bg-white/[0.08]", className)}
      role="separator"
      {...props}
    />
  );
}
