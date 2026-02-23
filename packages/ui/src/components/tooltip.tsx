"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          "z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs",
          "bg-[color-mix(in_srgb,var(--popover),white_40%)] dark:bg-[color-mix(in_srgb,var(--popover),white_25%)]",
          "text-popover-foreground",
          "border border-[color-mix(in_srgb,var(--primary)_30%,var(--border))]",
          "shadow-[0_4px_12px_color-mix(in_srgb,var(--background)_50%,transparent),0_1px_3px_color-mix(in_srgb,var(--background)_30%,transparent)]",
          "fade-in-0 zoom-in-95 animate-in",
          "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        sideOffset={sideOffset}
        style={style}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className="fill-[color-mix(in_srgb,var(--popover),white_40%)] dark:fill-[color-mix(in_srgb,var(--popover),white_25%)]"
          height={5}
          width={11}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
