"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const GlassAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    glowEffect?: boolean;
  }
>(({ className, glowEffect = true, ...props }, ref) => (
  <div className="relative">
    {glowEffect && (
      <div className="absolute -inset-1 rounded-full bg-linear-to-r from-[var(--accent)]/40 via-[var(--primary)]/40 to-[var(--gradient-from)]/40 opacity-70 blur-md" />
    )}
    <AvatarPrimitive.Root
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        "border-2 border-[var(--foreground)]/30 shadow-[0_4px_16px_var(--background)]",
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
));
GlassAvatar.displayName = AvatarPrimitive.Root.displayName;

const GlassAvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    className={cn("aspect-square h-full w-full", className)}
    ref={ref}
    {...props}
  />
));
GlassAvatarImage.displayName = AvatarPrimitive.Image.displayName;

const GlassAvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full",
      "bg-[var(--foreground)]/10 font-medium text-[var(--foreground)]/80 text-sm backdrop-blur-xl",
      className
    )}
    ref={ref}
    {...props}
  />
));
GlassAvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { GlassAvatar, GlassAvatarImage, GlassAvatarFallback };
