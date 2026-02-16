"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

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
  variant = "auto",
  children,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  variant?: "default" | "light" | "auto";
}) {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Auto-detect variant based on theme
  const resolvedVariant = variant === "auto" ? (isDark ? "default" : "light") : variant;

  const contentStyle: React.CSSProperties =
    resolvedVariant === "light"
      ? {
          background: `linear-gradient(to bottom right, 
          color-mix(in srgb, var(--gradient-from) 15%, transparent),
          color-mix(in srgb, var(--gradient-via) 15%, transparent),
          color-mix(in srgb, var(--gradient-to) 15%, transparent))`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid color-mix(in srgb, var(--gradient-via) 30%, transparent)",
          color: "var(--foreground)",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
          ...style,
        }
      : {
          background: `linear-gradient(to bottom right, 
          var(--gradient-from),
          var(--gradient-via),
          var(--gradient-to))`,
          color: "white",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
          ...style,
        };

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          "z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs",
          "fade-in-0 zoom-in-95 animate-in",
          "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        sideOffset={sideOffset}
        style={contentStyle}
        {...props}
      >
        {children}
        {resolvedVariant === "default" && (
          <TooltipPrimitive.Arrow
            height={5}
            style={{
              fill: "var(--gradient-via)",
            }}
            width={11}
          />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
