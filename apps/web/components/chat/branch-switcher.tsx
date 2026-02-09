"use client";

import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

interface BranchSwitcherProps {
  branch?: string;
  branchOptions?: string[];
  onSelect: (branch: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * BranchSwitcher - Navigate between conversation branches
 *
 * Displays prev/next controls when multiple branches exist at a fork point.
 * Follows LangGraph SDK patterns for branch navigation.
 *
 * Usage:
 * ```tsx
 * const metadata = stream.getMessagesMetadata(message);
 *
 * <BranchSwitcher
 *   branch={metadata?.branch}
 *   branchOptions={metadata?.branchOptions}
 *   onSelect={(branch) => stream.setBranch(branch)}
 * />
 * ```
 */
export function BranchSwitcher({
  branch,
  branchOptions,
  onSelect,
  className,
  size = "sm",
}: BranchSwitcherProps) {
  // Don't render if no branches or only one branch
  if (!branchOptions || branchOptions.length <= 1) {
    return null;
  }

  // Find the current branch index
  // Note: branch might be undefined for some messages, but we still want to show
  // the switcher if there are multiple branches available
  let index = branch ? branchOptions.indexOf(branch) : -1;

  // If branch is not found in options (can happen when navigating branches),
  // default to showing the first branch option but keep navigation working
  // This ensures the switcher remains visible
  if (index === -1) {
    // Log for debugging but don't hide the switcher
    if (branch) {
      console.log("[BranchSwitcher] Current branch not in message options:", {
        branch,
        branchOptions,
        message: "Showing switcher with navigation from first option",
      });
    }
    // Show as if we're on the first branch
    index = 0;
  }

  const hasPrev = index > 0;
  const hasNext = index < branchOptions.length - 1;

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "size-3",
    md: "size-4",
    lg: "size-5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full",
        "bg-muted/50 border border-border/50",
        "transition-all duration-200",
        className,
      )}
    >
      <GitBranch className="size-3 text-primary/70 mr-1" />

      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          sizeClasses[size],
          "p-0 hover:bg-primary/10",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          "transition-all duration-150",
        )}
        onClick={() => {
          if (hasPrev) {
            onSelect(branchOptions[index - 1]);
          }
        }}
        disabled={!hasPrev}
        aria-label="Previous branch"
      >
        <ChevronLeft className={cn(iconSizes[size], "text-muted-foreground")} />
      </Button>

      <span className="text-xs text-muted-foreground font-medium min-w-[3ch] text-center tabular-nums">
        {index + 1}/{branchOptions.length}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          sizeClasses[size],
          "p-0 hover:bg-primary/10",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          "transition-all duration-150",
        )}
        onClick={() => {
          if (hasNext) {
            onSelect(branchOptions[index + 1]);
          }
        }}
        disabled={!hasNext}
        aria-label="Next branch"
      >
        <ChevronRight
          className={cn(iconSizes[size], "text-muted-foreground")}
        />
      </Button>
    </div>
  );
}

/**
 * BranchIndicator - Shows current branch position without navigation
 *
 * Use this when you want to display branch info without interactive controls
 */
export function BranchIndicator({
  branch,
  branchOptions,
  className,
}: Omit<BranchSwitcherProps, "onSelect">) {
  if (!branchOptions || branchOptions.length <= 1) {
    return null;
  }

  const index = branch ? branchOptions.indexOf(branch) : -1;
  // Show position even if branch not found (show as first)
  const displayIndex = index === -1 ? 0 : index;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
        "bg-muted/30 border border-border/30",
        className,
      )}
    >
      <GitBranch className="size-3 text-primary/50" />
      <span className="text-xs text-muted-foreground">
        Branch {displayIndex + 1} of {branchOptions.length}
      </span>
    </div>
  );
}
