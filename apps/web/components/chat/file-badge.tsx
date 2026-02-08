"use client";

import React, { memo } from "react";
import { X } from "lucide-react";
import { getFileTypeConfig } from "@/lib/file-types";
import { cn } from "@workspace/ui/lib/utils"; // Assumes utils are here based on previous file reads
import { Button } from "@workspace/ui/components/button";

interface FileBadgeProps {
    name: string;
    size?: number;
    url?: string;
    type?: string;
    onRemove?: () => void;
    className?: string; // Allow custom classNames for flexibility
}

export const FileBadge = memo(function FileBadge({
    name,
    size,
    url,
    type,
    onRemove,
    className,
}: FileBadgeProps) {
    const config = getFileTypeConfig(name);
    const Icon = config.icon;
    const isImage = type?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].some(ext => name.toLowerCase().endsWith(ext));

    // Determine if we show a preview
    const showPreview = isImage && url;

    return (
        <div
            className={cn(
                "group relative flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2 transition-all hover:bg-muted/50",
                config.bgColor,
                className
            )}
            style={{ height: "80px", maxWidth: "260px", minWidth: "160px" }}
        >
            {/* Preview Area */}
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-background/40 flex items-center justify-center shadow-sm border border-border/10">
                {showPreview ? (
                    <img
                        src={url}
                        alt={name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <Icon className={cn("h-8 w-8 opacity-80", config.color)} />
                )}
            </div>

            {/* Content Area */}
            <div className="flex flex-col min-w-0 flex-1 justify-center gap-0.5">
                <span className="truncate text-xs font-semibold text-foreground/90 w-full" title={name}>
                    {name}
                </span>

                <div className="flex items-center gap-2">
                    {size && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
                            {size < 1024
                                ? `${size} B`
                                : `${(size / 1024).toFixed(size < 1024 * 10 ? 1 : 0)} KB`}
                        </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium opacity-50">
                        {name.split('.').pop() || 'FILE'}
                    </span>
                </div>
            </div>

            {/* Remove Button */}
            {onRemove && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background shadow-md border border-border text-muted-foreground opacity-0 transition-all hover:bg-destructive hover:text-destructive-foreground hover:scale-110 group-hover:opacity-100 p-0"
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
});
