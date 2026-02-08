"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

interface BranchSwitcherProps {
    branch?: string;
    branchOptions?: string[];
    onSelect: (branch: string) => void;
    className?: string;
}

/**
 * Component for navigating between conversation branches.
 * Shows the current branch position and allows switching between alternatives.
 * Logic strictly follows LangChain documentation.
 */
export function BranchSwitcher({
    branch,
    branchOptions,
    onSelect,
    className,
}: BranchSwitcherProps) {
    if (!branchOptions || !branch) return null;
    const index = branchOptions.indexOf(branch);

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full glass text-xs",
                className
            )}
        >
            <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 p-0 hover:bg-primary/20 disabled:opacity-30 cursor-pointer"
                onClick={() => {
                    onSelect(branchOptions[index - 1]);
                }}
                disabled={index <= 0}
            >
                <ChevronLeft className="size-3" />
            </Button>

            <span className="text-muted-foreground min-w-[3ch] text-center font-medium">
                {index + 1}/{branchOptions.length}
            </span>

            <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 p-0 hover:bg-primary/20 disabled:opacity-30 cursor-pointer"
                onClick={() => {
                    onSelect(branchOptions[index + 1]);
                }}
                disabled={index >= branchOptions.length - 1}
            >
                <ChevronRight className="size-3" />
            </Button>
        </div>
    );
}
