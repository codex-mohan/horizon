"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@workspace/ui/lib/utils"

const GlassAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    glowEffect?: boolean
  }
>(({ className, glowEffect = true, ...props }, ref) => (
  <div className="relative">
    {glowEffect && (
      <div className="absolute -inset-1 rounded-full bg-linear-to-r from-[var(--accent)]/40 via-[var(--primary)]/40 to-[var(--gradient-from)]/40 blur-md opacity-70" />
    )}
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        "border-2 border-[var(--foreground)]/30 shadow-[0_4px_16px_var(--background)]",
        className,
      )}
      {...props}
    />
  </div>
))
GlassAvatar.displayName = AvatarPrimitive.Root.displayName

const GlassAvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
))
GlassAvatarImage.displayName = AvatarPrimitive.Image.displayName

const GlassAvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full",
      "bg-[var(--foreground)]/10 backdrop-blur-xl text-[var(--foreground)]/80 text-sm font-medium",
      className,
    )}
    {...props}
  />
))
GlassAvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { GlassAvatar, GlassAvatarImage, GlassAvatarFallback }
