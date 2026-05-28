import {cva, type VariantProps} from "class-variance-authority";
import type {ComponentProps} from "react";
import {cn} from "@/shared/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7ff55]/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-[#b7ff55]/30 bg-[#b7ff55] text-[#071006] shadow-[0_0_28px_rgba(183,255,85,0.18)] hover:bg-[#c8ff79]",
        subtle:
          "border border-white/10 bg-white/[0.04] text-[#eef4e8] hover:border-[#b7ff55]/28 hover:bg-[#b7ff55]/10",
        ghost: "text-[#9ca596] hover:bg-white/[0.06] hover:text-[#f2f5ed]",
        outline:
          "border border-white/10 bg-transparent text-[#dbe4d4] hover:border-[#b7ff55]/28 hover:bg-white/[0.04]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "subtle",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

export function Button({className, size, variant, ...props}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({className, size, variant}))}
      {...props}
    />
  );
}
