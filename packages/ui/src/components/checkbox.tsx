"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import * as React from "react";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    className={cn(
      "peer size-5 shrink-0 rounded-md border-2 border-input",
      "ring-offset-background transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-primary data-[state=checked]:bg-gradient-to-br",
      "data-[state=checked]:from-[var(--gradient-from)] data-[state=checked]:via-[var(--gradient-via)] data-[state=checked]:to-[var(--gradient-to)]",
      "data-[state=checked]:text-white",
      "hover:border-primary/50 data-[state=checked]:hover:shadow-md data-[state=checked]:hover:shadow-primary/25",
      className
    )}
    ref={ref}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
