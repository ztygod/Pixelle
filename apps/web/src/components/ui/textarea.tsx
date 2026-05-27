import type {ComponentProps} from "react";
import {cn} from "../../lib/utils";

export function Textarea({className, ...props}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none border-0 bg-transparent text-sm leading-6 text-[#f2f5ed] outline-none placeholder:text-[#6f796b]",
        className,
      )}
      {...props}
    />
  );
}
