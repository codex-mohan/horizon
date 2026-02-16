"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils"; // Assumes utils are here based on previous file reads
import { X } from "lucide-react";
import { memo } from "react";
import { getFileTypeConfig } from "@/lib/file-types";

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
  const isImage =
    type?.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp"].some((ext) => name.toLowerCase().endsWith(ext));

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
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/10 bg-background/40 shadow-sm">
        {showPreview ? (
          <img
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={url}
          />
        ) : (
          <Icon className={cn("h-8 w-8 opacity-80", config.color)} />
        )}
      </div>

      {/* Content Area */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="w-full truncate font-semibold text-foreground/90 text-xs" title={name}>
          {name}
        </span>

        <div className="flex items-center gap-2">
          {size && (
            <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
              {size < 1024 ? `${size} B` : `${(size / 1024).toFixed(size < 1024 * 10 ? 1 : 0)} KB`}
            </span>
          )}
          <span className="font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider opacity-50">
            {name.split(".").pop() || "FILE"}
          </span>
        </div>
      </div>

      {/* Remove Button */}
      {onRemove && (
        <Button
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full border border-border bg-background p-0 text-muted-foreground opacity-0 shadow-md transition-all hover:scale-110 hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
});
