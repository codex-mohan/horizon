"use client";

import { cn } from "@workspace/ui/lib/utils";
import { CheckCircle2, Loader2, Terminal, XCircle } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import type { UIMessage } from "@/lib/chat";
import { getToolUIConfig } from "@/lib/tool-config";

export interface ToolCallData {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "executing" | "completed" | "failed";
  error?: string;
  uiMessage?: UIMessage;
}

interface ToolCallRowProps {
  toolCall: ToolCallData;
}

export function ToolCallRow({ toolCall }: ToolCallRowProps) {
  const config = getToolUIConfig(toolCall.name);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const statusIcon = {
    executing: <Loader2 className="h-4 w-4 animate-spin text-amber-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
  };

  const statusBg = {
    executing: "bg-amber-500/10",
    completed: "bg-emerald-500/10",
    failed: "bg-red-500/10",
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        isLight ? "border-border bg-muted/20" : "border-slate-700/30 bg-slate-900/30"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          isLight ? "bg-muted/30" : "bg-slate-800/30"
        )}
      >
        <div className={cn("rounded-lg p-1.5", config.icon.bgColor)}>
          <Terminal className={cn("h-3.5 w-3.5", config.icon.color)} />
        </div>
        <span
          className={cn(
            "flex-1 font-medium text-sm",
            isLight ? "text-foreground" : "text-slate-200"
          )}
        >
          {config.displayName}
        </span>
        <div className={cn("rounded-full p-1", statusBg[toolCall.status])}>
          {statusIcon[toolCall.status]}
        </div>
      </div>

      {Object.keys(toolCall.args).length > 0 && (
        <div className="border-border/30 border-t px-3 py-2">
          <pre
            className={cn(
              "max-h-32 overflow-auto font-mono text-xs",
              isLight ? "text-muted-foreground" : "text-slate-400"
            )}
          >
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </div>
      )}

      {toolCall.result && (
        <div className="border-border/30 border-t px-3 py-2">
          <pre
            className={cn(
              "max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs",
              isLight ? "text-foreground" : "text-slate-300"
            )}
          >
            {toolCall.result}
          </pre>
        </div>
      )}

      {toolCall.error && (
        <div
          className={cn(
            "border-t px-3 py-2 text-xs",
            isLight
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-red-500/20 bg-red-950/30 text-red-400"
          )}
        >
          {toolCall.error}
        </div>
      )}
    </div>
  );
}
