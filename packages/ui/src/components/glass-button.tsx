"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const glassButtonVariants = cva(
  cn(
    "relative inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "font-medium text-sm transition-all duration-300 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    "disabled:pointer-events-none disabled:opacity-50",
    "hover:scale-105 active:scale-95",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        default: cn(
          "border border-[var(--foreground)]/30 bg-[var(--foreground)]/20 text-[var(--foreground)] backdrop-blur-xl",
          "shadow-[0_4px_16px_var(--background)]",
          "hover:border-[var(--foreground)]/40 hover:bg-[var(--foreground)]/30",
          "before:absolute before:inset-0 before:rounded-xl",
          "before:pointer-events-none before:bg-linear-to-b before:from-[var(--foreground)]/20 before:to-transparent"
        ),
        primary: cn(
          "bg-linear-to-r from-[var(--accent)]/80 via-[var(--primary)]/80 to-[var(--gradient-from)]/80",
          "border border-[var(--foreground)]/30 text-[var(--foreground)] backdrop-blur-xl",
          "shadow-[0_4px_20px_var(--primary)]",
          "hover:shadow-[0_4px_30px_var(--primary)]",
          "before:absolute before:inset-0 before:rounded-xl",
          "before:pointer-events-none before:bg-linear-to-b before:from-[var(--foreground)]/30 before:to-transparent"
        ),
        outline: cn(
          "border-2 border-[var(--foreground)]/40 bg-transparent text-[var(--foreground)] backdrop-blur-sm",
          "hover:border-[var(--foreground)]/60 hover:bg-[var(--foreground)]/10"
        ),
        ghost: cn(
          "bg-transparent text-[var(--foreground)]/70",
          "hover:bg-[var(--foreground)]/10 hover:text-[var(--foreground)]"
        ),
        destructive: cn(
          "border border-[var(--destructive)]/40 bg-[var(--destructive)]/30 text-[var(--destructive-foreground)] backdrop-blur-xl",
          "shadow-[0_4px_16px_var(--destructive)]",
          "hover:border-[var(--destructive)]/60 hover:bg-[var(--destructive)]/40",
          "before:absolute before:inset-0 before:rounded-xl",
          "before:pointer-events-none before:bg-linear-to-b before:from-[var(--foreground)]/10 before:to-transparent"
        ),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  glowEffect?: boolean;
  asChild?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, asChild = false, size, glowEffect = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <div className="relative inline-block">
        {glowEffect && (
          <div className="absolute -inset-1 rounded-xl bg-linear-to-r from-cyan-500/40 via-blue-500/40 to-purple-500/40 opacity-70 blur-lg transition-opacity group-hover:opacity-100" />
        )}
        <Comp
          className={cn(glassButtonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </Comp>
      </div>
    );
  }
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };
