"use client";

/**
 * ArtifactCard — Inline card shown in chat messages when an artifact is detected.
 *
 * Compact, clickable card with type icon, title, and type badge.
 * Clicking opens the Artifact Viewer panel.
 */

import { cn } from "@horizon/ui/lib/utils";
import { Code, Component, FileText, GitBranch, Globe, Image } from "lucide-react";
import type { ArtifactType } from "@/lib/types/artifact";
import { ARTIFACT_TYPE_META } from "@/lib/types/artifact";

interface ArtifactCardProps {
  title: string;
  type: ArtifactType;
  language?: string;
  onClick: () => void;
  isActive?: boolean;
}

const TYPE_ICONS: Record<ArtifactType, typeof Globe> = {
  html: Globe,
  svg: Image,
  mermaid: GitBranch,
  code: Code,
  react: Component,
  markdown: FileText,
};

export function ArtifactCard({ title, type, language, onClick, isActive }: ArtifactCardProps) {
  const meta = ARTIFACT_TYPE_META[type];
  const Icon = TYPE_ICONS[type];

  return (
    <button
      className={cn(
        "group flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
        "glass hover-lift cursor-pointer",
        "hover:border-primary/40 hover:bg-primary/5",
        isActive && "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
      )}
      onClick={onClick}
      type="button"
    >
      {/* Icon */}
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          "bg-linear-to-br from-primary/20 to-accent/20",
          "transition-transform duration-200 group-hover:scale-110"
        )}
      >
        <Icon className={cn("size-5", meta.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-sm">{title}</div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]">
            {meta.label}
          </span>
          {language && <span className="text-muted-foreground text-[10px]">{language}</span>}
        </div>
      </div>

      {/* Open indicator */}
      <div className="text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </div>
    </button>
  );
}
