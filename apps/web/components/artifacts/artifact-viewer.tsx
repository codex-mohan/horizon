"use client";

/**
 * ArtifactViewer — Main viewer panel for artifact preview and source code.
 *
 * Slides in from the right side of the chat area as a split panel.
 * Features: Preview (sandboxed iframe) | Code (syntax highlighted CodeMirror) tabs,
 * with copy, download, and open-in-new-tab actions.
 *
 * The Code tab reuses the CodeBlock component from markdown-view.tsx which already
 * has the correct CodeMirror + theme-aware + language-aware setup.
 */

import { Button } from "@horizon/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@horizon/ui/components/tooltip";
import { cn } from "@horizon/ui/lib/utils";
import {
    Code,
    Component,
    Copy,
    Download,
    ExternalLink,
    Eye,
    FileText,
    GitBranch,
    Globe,
    Image,
    X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CodeBlock } from "@/components/markdown-view";
import type { ArtifactType } from "@/lib/types/artifact";
import { ARTIFACT_TYPE_META } from "@/lib/types/artifact";
import { useArtifactsStore } from "@/lib/stores/artifacts";
import { ArtifactIframe } from "./artifact-iframe";

type ViewerTab = "preview" | "code";

const TYPE_ICONS: Record<ArtifactType, typeof Globe> = {
    html: Globe,
    svg: Image,
    mermaid: GitBranch,
    code: Code,
    react: Component,
    markdown: FileText,
};

/** File extensions for download fallback */
const TYPE_EXTENSIONS: Record<ArtifactType, string> = {
    html: "html",
    svg: "svg",
    mermaid: "mmd",
    code: "txt",
    react: "tsx",
    markdown: "md",
};

/**
 * Map artifact type → language hint for CodeBlock.
 * CodeBlock reads this to pick the right CodeMirror language extension.
 */
const TYPE_TO_LANG: Record<ArtifactType, string> = {
    html: "html",
    svg: "html",       // SVG is parsed with the HTML extension
    mermaid: "mermaid",
    code: "text",
    react: "tsx",
    markdown: "markdown",
};

export function ArtifactViewer() {
    const { activeArtifactId, isPanelOpen, closePanel, getArtifactById } = useArtifactsStore();
    const [activeTab, setActiveTab] = useState<ViewerTab>("preview");

    const artifact = activeArtifactId ? getArtifactById(activeArtifactId) : null;

    // Language hint: explicit `language` field wins (code artifacts), then fall back to type mapping
    const langHint = artifact
        ? (artifact.language || TYPE_TO_LANG[artifact.type] || "text")
        : "text";

    const handleCopy = useCallback(async () => {
        if (!artifact) return;
        try {
            await navigator.clipboard.writeText(artifact.content);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Failed to copy");
        }
    }, [artifact]);

    const handleDownload = useCallback(() => {
        if (!artifact) return;
        const filename = artifact.fileName
            || `${artifact.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}.${TYPE_EXTENSIONS[artifact.type]}`;
        const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${filename}`);
    }, [artifact]);

    const handleOpenInNewTab = useCallback(() => {
        if (!artifact) return;
        const blob = new Blob([artifact.content], {
            type: artifact.type === "svg" ? "image/svg+xml" : "text/html",
        });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
    }, [artifact]);

    if (!isPanelOpen || !artifact) return null;

    const meta = ARTIFACT_TYPE_META[artifact.type];
    const Icon = TYPE_ICONS[artifact.type];
    const hasPreview = ["html", "svg", "mermaid", "react"].includes(artifact.type);

    return (
        <div className="glass-strong flex h-full w-[480px] shrink-0 animate-slide-in-right flex-col border-border border-l">
            {/* Header */}
            <div className="flex items-center justify-between border-border border-b px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            "bg-linear-to-br from-primary/20 to-accent/20"
                        )}
                    >
                        <Icon className={cn("size-4", meta.color)} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate font-display font-semibold text-sm">{artifact.title}</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]">
                                {meta.label}
                            </span>
                            {artifact.fileName && (
                                <span className="truncate text-muted-foreground text-[10px]">
                                    {artifact.fileName}
                                </span>
                            )}
                            {artifact.version > 1 && (
                                <span className="text-muted-foreground text-[10px]">v{artifact.version}</span>
                            )}
                        </div>
                    </div>
                </div>

                <Button
                    className="shrink-0 transition-transform duration-200 hover:scale-110"
                    onClick={closePanel}
                    size="icon-sm"
                    variant="ghost"
                >
                    <X className="size-4" />
                </Button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-border border-b">
                {hasPreview && (
                    <button
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 text-sm transition-all duration-200",
                            activeTab === "preview"
                                ? "border-primary border-b-2 font-medium text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab("preview")}
                        type="button"
                    >
                        <Eye className="size-3.5" />
                        Preview
                    </button>
                )}
                <button
                    className={cn(
                        "flex items-center gap-1.5 px-4 py-2 text-sm transition-all duration-200",
                        activeTab === "code" || !hasPreview
                            ? "border-primary border-b-2 font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab("code")}
                    type="button"
                >
                    <Code className="size-3.5" />
                    Code
                </button>
            </div>

            {/* Content */}
            <div className="relative flex-1 overflow-hidden">
                {activeTab === "preview" && hasPreview ? (
                    <ArtifactIframe
                        className="h-full"
                        content={artifact.content}
                        language={artifact.language}
                        type={artifact.type}
                    />
                ) : (
                    /* Code view — theme-aware CodeMirror via the shared CodeBlock component */
                    <div className="custom-scrollbar h-full overflow-auto">
                        <CodeBlock code={artifact.content} langHint={langHint} />
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-border border-t px-4 py-2.5">
                <span className="text-muted-foreground text-[11px]">
                    {artifact.content.split("\n").length} lines
                    {artifact.language ? ` • ${artifact.language}` : ""}
                </span>

                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="transition-transform duration-200 hover:scale-110"
                                    onClick={handleCopy}
                                    size="icon-sm"
                                    variant="ghost"
                                >
                                    <Copy className="size-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Copy</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="transition-transform duration-200 hover:scale-110"
                                    onClick={handleDownload}
                                    size="icon-sm"
                                    variant="ghost"
                                >
                                    <Download className="size-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Download {artifact.fileName}</TooltipContent>
                        </Tooltip>

                        {hasPreview && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        className="transition-transform duration-200 hover:scale-110"
                                        onClick={handleOpenInNewTab}
                                        size="icon-sm"
                                        variant="ghost"
                                    >
                                        <ExternalLink className="size-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Open in new tab</TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}
