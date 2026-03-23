"use client";

import { cn } from "@horizon/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Expand,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  Minimize2,
  Terminal,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  connectToWorkerEvents,
  disconnectFromWorkerEvents,
  useWorkerProgressStore,
  type WorkerCompletedEvent,
  type WorkerState,
  type WorkerStatus,
} from "@/lib/stores/worker-progress";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

interface WorkerToolProps {
  toolName: string;
  status: "pending" | "executing" | "completed" | "failed";
  args: {
    workers?: Array<{
      id?: string;
      name: string;
      task: string;
      systemPrompt?: string;
      tools?: string[];
      modelConfig?: unknown;
      timeout?: number;
    }>;
    runMode?: "parallel" | "sequential";
  };
  result?: string;
  error?: string;
  isLoading?: boolean;
  apiUrl?: string;
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

function getStatusColor(status: WorkerStatus): string {
  switch (status) {
    case "pending":
      return "text-muted-foreground";
    case "initializing":
      return "text-amber-400";
    case "running":
    case "tool_call":
      return "text-blue-400";
    case "completed":
      return "text-emerald-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function StatusIcon({ status }: { status: WorkerStatus }) {
  switch (status) {
    case "pending":
      return <Circle className="h-4 w-4" />;
    case "initializing":
    case "running":
    case "tool_call":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4" />;
    case "failed":
      return <XCircle className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

function ToolCallBadge({
  toolCall,
}: {
  toolCall?: { name: string; args?: Record<string, unknown> };
}) {
  if (!toolCall) return null;

  const iconMap: Record<string, React.ReactNode> = {
    shell_execute: <Terminal className="h-3 w-3" />,
    search_web: <ExternalLink className="h-3 w-3" />,
    fetch_url_content: <FileText className="h-3 w-3" />,
    create_artifact: <Bot className="h-3 w-3" />,
  };

  return (
    <div className="mt-1 flex items-center gap-1.5 rounded bg-blue-500/10 px-2 py-1">
      {iconMap[toolCall.name] || <Activity className="h-3 w-3" />}
      <span className="font-mono text-xs text-blue-400">{toolCall.name}</span>
    </div>
  );
}

function WorkerTab({
  worker,
  isActive,
  onClick,
}: {
  worker: WorkerState;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
        isActive
          ? "border-blue-500 bg-blue-500/10 text-foreground"
          : "border-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground"
      )}
      onClick={onClick}
    >
      <StatusIcon status={worker.status} />
      <span className="truncate max-w-[120px]">{worker.name}</span>
      {worker.status === "running" || worker.status === "tool_call" ? (
        <span className="flex h-2 w-2">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
      ) : null}
    </button>
  );
}

function WorkerDetail({
  worker,
  isExpanded,
  onToggleExpand,
}: {
  worker: WorkerState;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, height: "auto" }}
      className={cn(
        "overflow-hidden rounded-lg border",
        worker.status === "failed"
          ? "border-red-500/30 bg-red-500/5"
          : worker.status === "completed"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-primary/10 bg-primary/5"
      )}
      initial={{ opacity: 0, height: 0 }}
    >
      <div
        className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-primary/5"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{worker.name}</span>
          {worker.tools && worker.tools.length > 0 && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-muted-foreground">
              {worker.tools.length} tools
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {worker.executionTimeMs && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(worker.executionTimeMs)}
            </span>
          )}
          <span className={cn("flex items-center gap-1", getStatusColor(worker.status))}>
            <StatusIcon status={worker.status} />
          </span>
          {isExpanded ? (
            <Minimize2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Expand className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div className="border-t border-primary/10 px-3 py-2">
              <div className="mb-2 text-xs text-muted-foreground">
                <span className="font-medium">Status:</span>{" "}
                <span className={getStatusColor(worker.status)}>{worker.message}</span>
              </div>

              <ToolCallBadge toolCall={worker.toolCall} />

              {worker.errors && worker.errors.length > 0 && (
                <div className="mt-2 rounded border border-red-500/20 bg-red-500/10 p-2">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-red-500">
                    <XCircle className="h-3 w-3" />
                    Errors
                  </div>
                  <div className="space-y-1">
                    {worker.errors.map((err, i) => (
                      <div key={i} className="font-mono text-xs text-red-400">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {worker.output && (
                <div className="mt-2 rounded bg-black/20 p-2">
                  <pre className="max-h-48 overflow-auto font-mono text-xs text-white/80 whitespace-pre-wrap">
                    {worker.output}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

function SummaryDashboard({
  session,
}: {
  session: {
    runMode: "parallel" | "sequential";
    totalWorkers: number;
    completedWorkers: number;
    successCount: number;
    failureCount: number;
    finalResult?: {
      success: boolean;
      summary: string;
    };
  };
}) {
  const progress =
    session.totalWorkers > 0 ? (session.completedWorkers / session.totalWorkers) * 100 : 0;

  return (
    <div className="space-y-3 rounded-lg bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-sm">
            {session.runMode === "parallel" ? "Parallel" : "Sequential"} Execution
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {session.successCount}
          </span>
          {session.failureCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="h-3 w-3" />
              {session.failureCount}
            </span>
          )}
          <span className="text-muted-foreground">
            {session.completedWorkers}/{session.totalWorkers}
          </span>
        </div>
      </div>

      <ProgressBar progress={progress} />

      {session.finalResult && (
        <div
          className={cn(
            "rounded p-2 text-sm",
            session.finalResult.success
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          )}
        >
          {session.finalResult.summary}
        </div>
      )}
    </div>
  );
}

function parseResult(result?: string): {
  success: boolean;
  summary: string;
  results: WorkerCompletedEvent[];
  message: string;
} | null {
  if (!result) return null;
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}
export function WorkerTool({
  status,
  args,
  result,
  isLoading,
  apiUrl = "http://localhost:2024",
}: WorkerToolProps) {
  const [activeWorkerId, setActiveWorkerId] = useState<string | null>(null);
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const { createSession, getActiveSession } = useWorkerProgressStore();

  type WorkerArg = {
    id?: string;
    name: string;
    task: string;
    systemPrompt?: string;
    tools?: string[];
    modelConfig?: unknown;
    timeout?: number;
  };

  const workersArg: WorkerArg[] = args.workers || [];
  const runMode = args.runMode || "parallel";
  const isExecuting = (isLoading || status === "executing") && !result;

  const parsedResult = useMemo(() => parseResult(result), [result]);

  useEffect(() => {
    createSession(runMode);
    connectToWorkerEvents(apiUrl);

    return () => {
      disconnectFromWorkerEvents();
    };
  }, [createSession, runMode, apiUrl]);

  const activeSession = getActiveSession();
  const liveWorkers: WorkerState[] = activeSession ? Object.values(activeSession.workers) : [];
  const allWorkers = useMemo(() => {
    if (liveWorkers.length > 0) {
      return liveWorkers;
    }
    return workersArg.map((w, i) => ({
      id: w.id || `worker-${i}`,
      name: w.name,
      status: "pending" as WorkerStatus,
      tools: w.tools || [],
      message: "Waiting...",
    }));
  }, [liveWorkers, workersArg]);

  useEffect(() => {
    if (allWorkers.length > 0 && !activeWorkerId) {
      setActiveWorkerId(allWorkers[0].id);
    }
  }, [allWorkers, activeWorkerId]);

  const activeWorker = useMemo(() => {
    if (!activeWorkerId) return null;
    if (liveWorkers.length > 0) {
      return liveWorkers.find((w) => w.id === activeWorkerId) || liveWorkers[0];
    }
    return allWorkers.find((w) => w.id === activeWorkerId);
  }, [activeWorkerId, liveWorkers, allWorkers]);

  const hasLiveData = liveWorkers.length > 0;
  const progress = activeSession
    ? activeSession.totalWorkers > 0
      ? (activeSession.completedWorkers / activeSession.totalWorkers) * 100
      : 0
    : 0;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("overflow-hidden rounded-xl", "glass")}
      initial={{ opacity: 0, y: 10 }}
    >
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between px-3 py-2",
          "hover:bg-primary/5 transition-colors"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-500/20 p-1.5">
            <Bot className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {isExecuting ? "Running workers..." : `Workers (${runMode})`}
            </span>
            {hasLiveData && activeSession && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs">
                <span
                  className={cn(
                    activeSession.successCount > 0 && "text-emerald-400",
                    activeSession.failureCount > 0 && "text-red-400",
                    activeSession.successCount === 0 &&
                      activeSession.failureCount === 0 &&
                      "text-blue-400"
                  )}
                >
                  {activeSession.completedWorkers}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{activeSession.totalWorkers}</span>
              </span>
            )}
            {parsedResult && !hasLiveData && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                Done
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasLiveData && isExecuting && <ProgressBar progress={progress} />}
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <ToolStatusBadge status={status} />
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div className="border-t border-primary/10">
              {isExecuting && liveWorkers.length === 0 && (
                <div className="flex items-center justify-center gap-3 py-6">
                  <ModernSpinner size="md" />
                  <ShimmerText
                    className="text-sm"
                    text={`Starting ${workersArg.length || "multiple"} workers...`}
                  />
                </div>
              )}

              {hasLiveData && activeSession && (
                <div className="space-y-0">
                  <SummaryDashboard session={activeSession} />

                  <div className="flex overflow-x-auto border-b border-primary/10">
                    {allWorkers.map((worker) => (
                      <WorkerTab
                        key={worker.id}
                        worker={worker}
                        isActive={worker.id === activeWorkerId}
                        onClick={() => setActiveWorkerId(worker.id)}
                      />
                    ))}
                  </div>

                  {activeWorker && (
                    <div className="p-3">
                      <WorkerDetail
                        worker={activeWorker}
                        isExpanded={expandedWorkerId === activeWorker.id}
                        onToggleExpand={() =>
                          setExpandedWorkerId(
                            expandedWorkerId === activeWorker.id ? null : activeWorker.id
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {!hasLiveData && parsedResult && (
                <div className="space-y-0">
                  <div className="flex overflow-x-auto border-b border-primary/10">
                    {parsedResult.results.map((workerResult, i) => {
                      const worker = workersArg.find(
                        (w) => w.id === workerResult.task_id || w.name === workerResult.name
                      ) || { name: workerResult.name || `Worker ${i + 1}`, task: "", tools: [] };

                      return (
                        <button
                          key={workerResult.task_id || i}
                          className={cn(
                            "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                            (workerResult.task_id || String(i)) === activeWorkerId
                              ? "border-blue-500 bg-blue-500/10 text-foreground"
                              : "border-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                          )}
                          onClick={() => setActiveWorkerId(workerResult.task_id || String(i))}
                        >
                          {workerResult.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                          <span className="truncate max-w-[120px]">{worker.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-3">
                    {parsedResult.results.map((workerResult, i) => {
                      const worker = workersArg.find(
                        (w) => w.id === workerResult.task_id || w.name === workerResult.name
                      ) || { name: workerResult.name || `Worker ${i + 1}`, task: "", tools: [] };

                      return (
                        <div
                          key={workerResult.task_id || i}
                          className={cn(
                            "mb-2 overflow-hidden rounded-lg border",
                            workerResult.status === "failure"
                              ? "border-red-500/30 bg-red-500/5"
                              : "border-emerald-500/30 bg-emerald-500/5",
                            (workerResult.task_id || String(i)) !== activeWorkerId && "hidden"
                          )}
                        >
                          <div className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{worker.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {workerResult.execution_time_ms && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDuration(workerResult.execution_time_ms)}
                                </span>
                              )}
                              {workerResult.status === "success" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                            </div>
                          </div>

                          <div className="border-t border-primary/10 px-3 py-2">
                            {workerResult.errors && workerResult.errors.length > 0 && (
                              <div className="mb-2 rounded border border-red-500/20 bg-red-500/10 p-2">
                                <div className="space-y-1">
                                  {workerResult.errors.map((err, j) => (
                                    <div key={j} className="font-mono text-xs text-red-400">
                                      {err}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {workerResult.output && (
                              <div className="rounded bg-black/20 p-2">
                                <pre className="max-h-32 overflow-auto font-mono text-xs text-white/80 whitespace-pre-wrap">
                                  {workerResult.output}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {parsedResult.message && (
                      <div
                        className={cn(
                          "mt-2 rounded-lg p-2 text-sm",
                          parsedResult.success
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {parsedResult.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!hasLiveData && !parsedResult && workersArg.length > 0 && !isExecuting && (
                <div className="p-3">
                  <div className="space-y-2">
                    {workersArg.map((worker, i) => (
                      <div
                        key={worker.id || i}
                        className="flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 p-2"
                      >
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="text-sm">{worker.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {worker.tools?.length || 0} tools
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
