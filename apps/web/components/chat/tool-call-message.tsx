"use client";

import { json } from "@codemirror/lang-json";
import { EditorView, lineNumbers } from "@codemirror/view";
import { cn } from "@workspace/ui/lib/utils";
import { CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { createCodeMirrorTheme } from "@/lib/codemirror-theme";
import { getToolIcon, getToolUIConfig } from "@/lib/tool-config";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="h-16 animate-pulse rounded bg-muted/50" />,
});

export interface ToolCall {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status: "loading" | "success" | "error" | "completed";
  startedAt?: number;
  completedAt?: number;
  error?: string;
  namespace?: "special" | "generic";
}

interface ToolCallMessageProps {
  toolCalls: ToolCall[];
  isLoading?: boolean;
  className?: string;
}

const JsonViewer: React.FC<{ data: unknown; maxHeight?: string }> = React.memo(
  ({ data, maxHeight = "200px" }) => {
    const { themeMode } = useTheme();
    const cmTheme = useMemo(
      () => createCodeMirrorTheme(themeMode === "dark"),
      [themeMode]
    );

    const extensions = useMemo(
      () => [
        json(),
        lineNumbers(),
        EditorView.editable.of(false),
        EditorView.lineWrapping,
      ],
      []
    );

    const formattedJson = useMemo(() => {
      try {
        if (typeof data === "string") {
          const parsed = JSON.parse(data);
          return JSON.stringify(parsed, null, 2);
        }
        return JSON.stringify(data, null, 2);
      } catch {
        return typeof data === "string" ? data : String(data);
      }
    }, [data]);

    return (
      <div
        className="overflow-hidden rounded-lg border border-border"
        style={{ maxHeight }}
      >
        <CodeMirror
          basicSetup={{
            foldGutter: true,
            syntaxHighlighting: false,
            lineNumbers: false,
          }}
          editable={false}
          extensions={extensions}
          height="auto"
          maxHeight={maxHeight}
          theme={cmTheme}
          value={formattedJson}
        />
      </div>
    );
  }
);
JsonViewer.displayName = "JsonViewer";

export function ToolCallMessage({
  toolCalls,
  isLoading = false,
  className,
}: ToolCallMessageProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";

  const loadingCount = toolCalls.filter((tc) => tc.status === "loading").length;

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

  if (toolCalls.length === 0 && !isLoading) {
    return null;
  }

  const firstToolConfig =
    toolCalls.length > 0 ? getToolUIConfig(toolCalls[0].name) : null;
  const FirstToolIcon =
    toolCalls.length > 0 ? getToolIcon(toolCalls[0].name) : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl transition-all duration-500 ease-out",
        isLightTheme
          ? "border border-white/50 bg-white/40 shadow-lg backdrop-blur-xl"
          : "glass-strong border border-primary/20 shadow-xl",
        className
      )}
    >
      <button
        className={cn(
          "flex w-full items-center justify-between px-4 py-3",
          "transition-colors duration-300",
          isLightTheme ? "hover:bg-black/5" : "hover:bg-white/5"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-2 font-medium text-[1.05rem]",
              isLightTheme ? "text-slate-700" : "text-foreground"
            )}
          >
            {FirstToolIcon && (
              <FirstToolIcon
                className={cn(
                  "h-4 w-4",
                  isLoading
                    ? "animate-pulse text-primary"
                    : isLightTheme
                      ? "text-slate-500"
                      : "text-muted-foreground"
                )}
              />
            )}
            {toolCalls.length === 1 && firstToolConfig
              ? firstToolConfig.displayName
              : toolCalls.length > 1
                ? `${toolCalls.length} Tools`
                : "Tools"}
            {toolCalls.length > 1 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.95rem]",
                  isLightTheme
                    ? "bg-slate-200 text-slate-700"
                    : "bg-primary/20 text-primary"
                )}
              >
                {toolCalls.length}
              </span>
            )}
            {isLoading && (
              <span
                className={cn(
                  "flex items-center gap-1 text-[0.95rem]",
                  isLightTheme ? "text-amber-600" : "text-amber-400"
                )}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                {loadingCount > 0 ? `${loadingCount} running` : "Waiting..."}
              </span>
            )}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 transition-transform duration-300",
            isLightTheme ? "text-slate-500" : "text-muted-foreground",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-out",
            "animate-slide-down"
          )}
        >
          <div
            className={cn(
              "custom-scrollbar max-h-96 space-y-2 overflow-y-auto p-3",
              isLightTheme ? "scrollbar-light" : ""
            )}
          >
            {toolCalls.length > 0 ? (
              toolCalls.map((toolCall, index) => {
                const isLast = index === toolCalls.length - 1;
                const showConnector = !isLast;
                const toolConfig = getToolUIConfig(toolCall.name);
                const ToolIcon = getToolIcon(toolCall.name);

                return (
                  <div
                    className={cn(
                      "stagger-item relative animate-slide-up pb-3 pl-7",
                      "transition-all duration-500 ease-out"
                    )}
                    key={toolCall.id || index}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {showConnector && (
                      <div
                        className={cn(
                          "absolute top-8 left-[11px] h-[calc(100%-2rem)] w-px",
                          isLightTheme
                            ? "bg-gradient-to-b from-transparent via-slate-300 to-transparent"
                            : "bg-gradient-to-b from-transparent via-primary/20 to-transparent"
                        )}
                      />
                    )}

                    <div
                      className={cn(
                        "absolute top-1 left-0 h-6 w-6 rounded-full",
                        "flex items-center justify-center",
                        `bg-gradient-to-br ${getStatusBgColor(toolCall.status)}`,
                        "shadow-lg ring-4 ring-background/50",
                        "transition-transform duration-300 hover:scale-110"
                      )}
                    >
                      <span className="text-white">
                        {getStatusIcon(toolCall.status)}
                      </span>
                    </div>

                    <div className="pt-0.5">
                      <div className="mb-1 flex items-center gap-2">
                        {ToolIcon && (
                          <ToolIcon
                            className={cn(
                              "h-3.5 w-3.5",
                              getStatusColor(toolCall.status)
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            "font-medium text-sm",
                            isLightTheme ? "text-slate-700" : "text-foreground"
                          )}
                        >
                          {toolConfig.displayName}
                        </span>
                      </div>

                      {toolCall.arguments &&
                        Object.keys(toolCall.arguments).length > 0 && (
                          <div className="ml-5">
                            <JsonViewer
                              data={toolCall.arguments}
                              maxHeight="150px"
                            />
                          </div>
                        )}

                      {toolCall.result && (
                        <div className="mt-2 ml-5">
                          <JsonViewer
                            data={toolCall.result}
                            maxHeight="150px"
                          />
                        </div>
                      )}

                      {toolCall.error && (
                        <div
                          className={cn(
                            "mt-2 ml-5 rounded p-2 text-xs",
                            isLightTheme
                              ? "bg-red-50 text-red-600"
                              : "bg-red-950/30 text-red-400"
                          )}
                        >
                          Error: {toolCall.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className={cn(
                  "py-4 text-center text-sm",
                  isLightTheme ? "text-slate-500" : "text-muted-foreground"
                )}
              >
                No tool calls
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
