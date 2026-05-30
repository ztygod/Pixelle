import {cva, type VariantProps} from "class-variance-authority";
import type {ComponentProps} from "react";
import {cn} from "@/shared/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-[var(--color-accent-border)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)] shadow-[0_0_28px_color-mix(in_srgb,var(--color-accent)_18%,transparent)] hover:bg-[var(--color-accent-hover)]",
        subtle:
          "border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-elevated)]",
        ghost:
          "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]",
        outline:
          "border border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-card)]",
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
