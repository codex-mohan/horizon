"use client";

import React from "react";
import { cn } from "@workspace/ui/lib/utils";
import {
  Loader2,
  Terminal,
  ChevronDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

export interface ToolCall {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status: "loading" | "success" | "error" | "completed";
}

interface ToolCallMessageProps {
  toolCalls: ToolCall[];
  isLoading?: boolean;
  className?: string;
}

export function ToolCallMessage({
  toolCalls,
  isLoading = false,
  className,
}: ToolCallMessageProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";

  const loadingCount = toolCalls.filter((tc) => tc.status === "loading").length;
  const completedCount = toolCalls.filter(
    (tc) => tc.status === "completed" || tc.status === "success",
  ).length;
  const errorCount = toolCalls.filter((tc) => tc.status === "error").length;

  const getStatusIcon = (status: ToolCall["status"]) => {
    switch (status) {
      case "loading":
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case "success":
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />;
      case "error":
        return <XCircle className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: ToolCall["status"]) => {
    switch (status) {
      case "loading":
        return isLightTheme ? "text-amber-600" : "text-amber-400";
      case "success":
      case "completed":
        return isLightTheme ? "text-emerald-600" : "text-emerald-400";
      case "error":
        return isLightTheme ? "text-red-600" : "text-red-400";
    }
  };

  const getStatusBgColor = (status: ToolCall["status"]) => {
    switch (status) {
      case "loading":
        return "from-amber-500 to-orange-500";
      case "error":
        return "from-red-500 to-rose-500";
      case "success":
      case "completed":
        return "from-emerald-500 to-teal-500";
      default:
        return "from-blue-500 to-indigo-500";
    }
  };

  if (toolCalls.length === 0 && !isLoading) return null;

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden transition-all duration-500 ease-out",
        isLightTheme
          ? "bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg"
          : "glass-strong border border-primary/20 shadow-xl",
        className,
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between",
          "transition-colors duration-300",
          isLightTheme ? "hover:bg-black/5" : "hover:bg-white/5",
        )}
      >
        <span
          className={cn(
            "text-sm font-medium flex items-center gap-2",
            isLightTheme ? "text-slate-700" : "text-foreground",
          )}
        >
          <Terminal
            className={cn(
              "h-4 w-4",
              isLoading
                ? "animate-pulse text-primary"
                : isLightTheme
                  ? "text-slate-500"
                  : "text-muted-foreground",
            )}
          />
          Tool Calls
          {toolCalls.length > 0 && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                isLightTheme
                  ? "bg-slate-200 text-slate-700"
                  : "bg-primary/20 text-primary",
              )}
            >
              {toolCalls.length}
            </span>
          )}
          {isLoading && (
            <span
              className={cn(
                "text-xs flex items-center gap-1",
                isLightTheme ? "text-amber-600" : "text-amber-400",
              )}
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {loadingCount > 0 ? `${loadingCount} running` : "Waiting..."}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            isLightTheme ? "text-slate-500" : "text-muted-foreground",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {isExpanded && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-out",
            "animate-slide-down",
          )}
        >
          <div
            className={cn(
              "max-h-80 overflow-y-auto custom-scrollbar p-3 space-y-2",
              isLightTheme ? "scrollbar-light" : "",
            )}
          >
            {toolCalls.length > 0 ? (
              toolCalls.map((toolCall, index) => {
                const isLast = index === toolCalls.length - 1;
                const showConnector = !isLast;

                return (
                  <div
                    key={toolCall.id || index}
                    className={cn(
                      "relative pl-7 pb-3 animate-slide-up stagger-item",
                      "transition-all duration-500 ease-out",
                    )}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {showConnector && (
                      <div
                        className={cn(
                          "absolute left-[11px] top-8 h-[calc(100%-2rem)] w-px",
                          isLightTheme
                            ? "bg-gradient-to-b from-transparent via-slate-300 to-transparent"
                            : "bg-gradient-to-b from-transparent via-primary/20 to-transparent",
                        )}
                      />
                    )}

                    <div
                      className={cn(
                        "absolute left-0 top-1 h-6 w-6 rounded-full",
                        "flex items-center justify-center",
                        `bg-gradient-to-br ${getStatusBgColor(toolCall.status)}`,
                        "shadow-lg ring-4 ring-background/50",
                        "transition-transform duration-300 hover:scale-110",
                      )}
                    >
                      <span className="text-white">
                        {getStatusIcon(toolCall.status)}
                      </span>
                    </div>

                    <div className="pt-0.5">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium transition-colors duration-300",
                            isLightTheme ? "text-slate-700" : "text-foreground",
                          )}
                        >
                          {toolCall.name}
                        </p>
                        <span
                          className={cn(
                            "text-xs",
                            getStatusColor(toolCall.status),
                          )}
                        >
                          {toolCall.status === "loading"
                            ? "Running..."
                            : toolCall.status === "completed"
                              ? "Done"
                              : toolCall.status === "success"
                                ? "Success"
                                : "Error"}
                        </span>
                      </div>

                      {toolCall.arguments &&
                        Object.keys(toolCall.arguments).length > 0 && (
                          <div
                            className={cn(
                              "mt-2 p-2 rounded-lg text-xs font-mono",
                              "overflow-x-auto",
                              isLightTheme
                                ? "bg-slate-100 text-slate-700"
                                : "bg-black/30 text-muted-foreground",
                            )}
                          >
                            <pre className="whitespace-pre-wrap break-all">
                              {JSON.stringify(toolCall.arguments, null, 2)}
                            </pre>
                          </div>
                        )}

                      {toolCall.result && (
                        <div
                          className={cn(
                            "mt-2 p-2 rounded-lg text-xs",
                            isLightTheme
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-emerald-950/30 text-emerald-400",
                          )}
                        >
                          <span className="font-medium">Result: </span>
                          {typeof toolCall.result === "string"
                            ? toolCall.result
                            : JSON.stringify(toolCall.result, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : isLoading ? (
              <div className={cn("relative pl-7 pb-2 animate-pulse")}>
                <div
                  className={cn(
                    "absolute left-0 top-1 h-6 w-6 rounded-full",
                    "flex items-center justify-center",
                    "bg-gradient-to-br from-amber-500 to-orange-500",
                    "ring-4 ring-background/50",
                  )}
                >
                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                </div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    isLightTheme ? "text-slate-600" : "text-foreground",
                  )}
                >
                  Waiting for tools...
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
