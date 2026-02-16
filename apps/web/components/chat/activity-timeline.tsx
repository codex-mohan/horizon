"use client";

import { cn } from "@workspace/ui/lib/utils";
import {
  Activity,
  Brain,
  Check,
  ChevronDown,
  Hash,
  Loader2,
  Minimize2,
  Rocket,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import React from "react";
import { useTheme } from "@/components/theme/theme-provider";

export interface ProcessedEvent {
  title: string;
  data: string;
  icon?: string;
  timestamp?: number;
}

interface ActivityTimelineProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
}

const eventConfig: Record<string, { color: string; glow: string; icon: React.ReactNode }> = {
  rocket: {
    color: "from-blue-500 to-indigo-500",
    glow: "shadow-blue-500/30",
    icon: <Rocket className="h-4 w-4" />,
  },
  brain: {
    color: "from-purple-500 to-pink-500",
    glow: "shadow-purple-500/30",
    icon: <Brain className="h-4 w-4" />,
  },
  cpu: {
    color: "from-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/30",
    icon: <Activity className="h-4 w-4" />,
  },
  wrench: {
    color: "from-orange-500 to-amber-500",
    glow: "shadow-orange-500/30",
    icon: <Wrench className="h-4 w-4" />,
  },
  hash: {
    color: "from-gray-400 to-gray-500",
    glow: "shadow-gray-500/30",
    icon: <Hash className="h-4 w-4" />,
  },
  compress: {
    color: "from-yellow-500 to-orange-500",
    glow: "shadow-yellow-500/30",
    icon: <Minimize2 className="h-4 w-4" />,
  },
  check: {
    color: "from-emerald-400 to-green-500",
    glow: "shadow-emerald-500/30",
    icon: <Check className="h-4 w-4" />,
  },
  search: {
    color: "from-cyan-500 to-blue-500",
    glow: "shadow-cyan-500/30",
    icon: <Search className="h-4 w-4" />,
  },
  sparkles: {
    color: "from-violet-500 to-purple-500",
    glow: "shadow-violet-500/30",
    icon: <Sparkles className="h-4 w-4" />,
  },
};

export function ActivityTimeline({ processedEvents, isLoading }: ActivityTimelineProps) {
  const [isTimelineCollapsed, setIsTimelineCollapsed] = React.useState(false);
  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";

  React.useEffect(() => {
    if (!isLoading && processedEvents.length > 0) {
      setIsTimelineCollapsed(false);
    }
  }, [isLoading, processedEvents.length]);

  const getEventStyle = (icon?: string) => {
    const config = eventConfig[icon || ""] || eventConfig.cpu;
    return config;
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl transition-all duration-500 ease-out",
        isLightTheme
          ? "border border-white/50 bg-white/40 shadow-lg backdrop-blur-xl"
          : "glass border border-primary/20 shadow-xl"
      )}
    >
      <button
        className={cn(
          "flex w-full items-center justify-between px-4 py-3",
          "transition-colors duration-300",
          isLightTheme ? "hover:bg-black/5" : "hover:bg-white/5"
        )}
        onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
      >
        <span
          className={cn(
            "flex items-center gap-2 font-medium text-sm",
            isLightTheme ? "text-slate-700" : "text-foreground"
          )}
        >
          <Sparkles
            className={cn(
              "h-4 w-4",
              isLoading
                ? "animate-pulse text-primary"
                : isLightTheme
                  ? "text-slate-500"
                  : "text-muted-foreground"
            )}
          />
          Activity
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            isLightTheme ? "text-slate-500" : "text-muted-foreground",
            !isTimelineCollapsed && "rotate-180"
          )}
        />
      </button>

      {!isTimelineCollapsed && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-out",
            "animate-slide-down"
          )}
        >
          <div
            className={cn(
              "custom-scrollbar max-h-64 space-y-2 overflow-y-auto p-3",
              isLightTheme ? "scrollbar-light" : ""
            )}
          >
            {isLoading && processedEvents.length === 0 && (
              <div
                className={cn(
                  "relative animate-pulse pb-3 pl-8",
                  "before:absolute before:top-3 before:left-[11px] before:h-full before:w-px",
                  isLightTheme
                    ? "before:bg-gradient-to-b before:from-transparent before:to-slate-300"
                    : "before:bg-gradient-to-b before:from-transparent before:to-primary/30"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 left-0 h-6 w-6 rounded-full",
                    "flex items-center justify-center",
                    "bg-gradient-to-br from-primary/20 to-accent/20",
                    "ring-4 ring-background/50"
                  )}
                >
                  <Loader2
                    className={cn(
                      "h-3 w-3 animate-spin",
                      isLightTheme ? "text-slate-600" : "text-primary"
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "font-medium text-sm",
                    isLightTheme ? "text-slate-600" : "text-foreground"
                  )}
                >
                  Starting...
                </p>
              </div>
            )}

            {processedEvents.length > 0 ? (
              <div className="space-y-1">
                {processedEvents.map((eventItem, index) => {
                  const style = getEventStyle(eventItem.icon);
                  const isLast = index === processedEvents.length - 1;
                  const showConnector = !isLast || (isLoading && isLast);

                  return (
                    <div
                      className={cn(
                        "stagger-item relative animate-slide-up pb-2 pl-7",
                        "transition-all duration-500 ease-out"
                      )}
                      key={index}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {showConnector && (
                        <div
                          className={cn(
                            "absolute top-6 left-[11px] h-[calc(100%-1.5rem)] w-px",
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
                          `bg-gradient-to-br ${style.color}`,
                          "shadow-lg",
                          style.glow,
                          "ring-4 ring-background/50",
                          "transition-transform duration-300 hover:scale-110"
                        )}
                      >
                        <span
                          className={cn(
                            "text-white",
                            isLoading && index === processedEvents.length - 1 && "animate-pulse"
                          )}
                        >
                          {style.icon}
                        </span>
                      </div>

                      <div className="pt-0.5">
                        <p
                          className={cn(
                            "font-medium text-sm transition-colors duration-300",
                            isLightTheme ? "text-slate-700" : "text-foreground",
                            "group-hover:text-primary"
                          )}
                        >
                          {eventItem.title}
                        </p>
                        <p
                          className={cn(
                            "text-xs leading-relaxed transition-colors duration-300",
                            isLightTheme ? "text-slate-500" : "text-muted-foreground"
                          )}
                        >
                          {eventItem.data}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {isLoading && processedEvents.length > 0 && (
                  <div className={cn("relative animate-pulse pb-2 pl-7")}>
                    <div
                      className={cn(
                        "absolute top-1 left-0 h-6 w-6 rounded-full",
                        "flex items-center justify-center",
                        "bg-gradient-to-br from-primary/30 to-accent/30",
                        "ring-4 ring-background/50",
                        "animate-pulse"
                      )}
                    >
                      <Loader2
                        className={cn(
                          "h-3 w-3 animate-spin",
                          isLightTheme ? "text-slate-600" : "text-primary"
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "font-medium text-sm",
                        isLightTheme ? "text-slate-600" : "text-foreground"
                      )}
                    >
                      Processing...
                    </p>
                  </div>
                )}
              </div>
            ) : isLoading ? null : (
              <div className={cn("flex h-20 flex-col items-center justify-center", "text-center")}>
                <Activity
                  className={cn(
                    "mb-2 h-5 w-5",
                    isLightTheme ? "text-slate-400" : "text-muted-foreground/50"
                  )}
                />
                <p
                  className={cn(
                    "text-xs",
                    isLightTheme ? "text-slate-500" : "text-muted-foreground"
                  )}
                >
                  Timeline updates during processing
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
