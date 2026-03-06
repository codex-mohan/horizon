"use client";

/**
 * ArtifactTool — Generative UI component for create_artifact and present_artifact tools.
 *
 * - create_artifact: Shows a compact "Creating [title]..." shimmer during execution,
 *   then "Created [title] ✓" on completion.
 * - present_artifact: Shows the full ArtifactCard that opens the viewer panel on click.
 */

import { cn } from "@horizon/ui/lib/utils";
import { motion } from "framer-motion";
import {
    Check,
    Code,
    Component,
    FileText,
    GitBranch,
    Globe,
    Image,
    Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { useArtifactsStore } from "@/lib/stores/artifacts";
import type { ArtifactType } from "@/lib/types/artifact";
import { ARTIFACT_TYPE_META } from "@/lib/types/artifact";
import { ShimmerText, ModernSpinner } from "./loading-effects";

interface ArtifactToolProps {
    toolName: string;
    status: "pending" | "executing" | "completed" | "failed";
    args: Record<string, unknown>;
    result?: string;
    error?: string;
    isLoading?: boolean;
}

const TYPE_ICONS: Record<string, typeof Globe> = {
    html: Globe,
    svg: Image,
    mermaid: GitBranch,
    code: Code,
    react: Component,
    markdown: FileText,
};

interface ParsedResult {
    id?: string;
    title?: string;
    fileName?: string;
    type?: string;
    language?: string;
    content?: string;
    version?: number;
    error?: string;
}

function parseResult(result?: string): ParsedResult | null {
    if (!result) return null;
    try {
        return JSON.parse(result);
    } catch {
        return null;
    }
}

export function ArtifactTool({ toolName, status, args, result, error, isLoading }: ArtifactToolProps) {
    const { themeMode } = useTheme();
    const isLight = themeMode === "light";
    const parsed = useMemo(() => parseResult(result), [result]);
    const { addArtifact, setActiveArtifact, openPanel, getArtifactById } = useArtifactsStore();

    // Extract display info from args or result
    const title = (parsed?.title || args.title || "Artifact") as string;
    const type = (parsed?.type || args.type || "code") as string;
    const meta = ARTIFACT_TYPE_META[type as ArtifactType] || ARTIFACT_TYPE_META.code;
    const Icon = TYPE_ICONS[type] || Code;

    const isExecuting = (isLoading || status === "executing") && !result && !error;
    const isComplete = status === "completed" && parsed && !parsed.error;
    const isFailed = status === "failed" || !!error || parsed?.error;

    // When present_artifact completes, add the artifact to the store
    useEffect(() => {
        if (toolName !== "present_artifact" || !isComplete || !parsed?.id || !parsed?.content) return;

        // Only add if not already in store
        const existing = getArtifactById(parsed.id);
        if (existing) return;

        addArtifact({
            id: parsed.id,
            threadId: "",
            messageId: "",
            title: parsed.title || "Artifact",
            fileName: parsed.fileName || parsed.title || "artifact",
            type: (parsed.type || "code") as ArtifactType,
            language: parsed.language,
            content: parsed.content,
            version: parsed.version || 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }, [toolName, isComplete, parsed, addArtifact, getArtifactById]);

    const handleClick = useCallback(() => {
        if (!parsed?.id) return;
        setActiveArtifact(parsed.id);
        openPanel(parsed.id);
    }, [parsed, setActiveArtifact, openPanel]);

    // ─── create_artifact: compact status line ───
    if (toolName === "create_artifact") {
        return (
            <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2",
                    isLight ? "bg-muted/40" : "bg-white/3"
                )}
                initial={{ opacity: 0, y: 6 }}
            >
                <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", meta.color.replace("text-", "bg-").replace("400", "500/15"))}>
                    {isExecuting ? (
                        <ModernSpinner size="sm" />
                    ) : isComplete ? (
                        <Check className="size-3.5 text-emerald-400" />
                    ) : (
                        <Icon className={cn("size-3.5", meta.color)} />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    {isExecuting ? (
                        <ShimmerText
                            className={cn("text-sm", isLight ? "text-foreground" : "")}
                            text={`Creating ${title}...`}
                        />
                    ) : isComplete ? (
                        <span className="text-sm text-muted-foreground">
                            Created <span className="font-medium text-foreground">{title}</span>
                            <span className="ml-1.5 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {meta.label}
                            </span>
                        </span>
                    ) : isFailed ? (
                        <span className="text-sm text-destructive">
                            Failed to create artifact{error ? `: ${error}` : ""}
                        </span>
                    ) : (
                        <span className="text-sm text-muted-foreground">Creating {title}...</span>
                    )}
                </div>
            </motion.div>
        );
    }

    // ─── present_artifact: clickable artifact card ───
    if (toolName === "present_artifact") {
        if (isExecuting) {
            return (
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2",
                        isLight ? "bg-muted/40" : "bg-white/3"
                    )}
                    initial={{ opacity: 0, y: 6 }}
                >
                    <ModernSpinner size="sm" />
                    <ShimmerText
                        className={cn("text-sm", isLight ? "text-foreground" : "")}
                        text="Loading artifact..."
                    />
                </motion.div>
            );
        }

        if (isFailed) {
            return (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Failed to load artifact{parsed?.error ? `: ${parsed.error}` : ""}
                </div>
            );
        }

        if (isComplete && parsed) {
            return (
                <motion.button
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "group flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                        isLight
                            ? "border-border bg-white/60 shadow-sm hover:border-primary/30 hover:bg-white/80 hover:shadow-md"
                            : "glass hover-lift hover:border-primary/40 hover:bg-primary/5"
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    onClick={handleClick}
                    type="button"
                >
                    {/* Icon */}
                    <div
                        className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                            "bg-linear-to-br from-primary/20 to-accent/20"
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
                            {parsed.language && (
                                <span className="text-muted-foreground text-[10px]">{parsed.language}</span>
                            )}
                            {parsed.version && parsed.version > 1 && (
                                <span className="text-muted-foreground text-[10px]">v{parsed.version}</span>
                            )}
                        </div>
                    </div>

                    {/* Click hint */}
                    <div className="text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Sparkles className="size-4" />
                    </div>
                </motion.button>
            );
        }
    }

    // Fallback
    return null;
}
