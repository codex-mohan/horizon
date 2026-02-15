"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  Terminal,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";

export interface ToolApprovalData {
  type: "tool_approval_required";
  tool_call: {
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: string;
  };
  all_pending_tools: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: string;
  }>;
  auto_execute_tools: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: string;
  }>;
  message: string;
}

interface ToolApprovalDialogProps {
  isOpen: boolean;
  data: ToolApprovalData | null;
  onApprove: () => void;
  onReject: () => void;
  className?: string;
}

function getToolRiskLevel(toolName: string): "low" | "medium" | "high" {
  const highRiskTools = [
    "shell_execute",
    "file_write",
    "file_delete",
    "system_command",
    "execute_code",
  ];
  const mediumRiskTools = ["file_read", "fetch_url_content", "search_web"];

  if (highRiskTools.includes(toolName)) return "high";
  if (mediumRiskTools.includes(toolName)) return "medium";
  return "low";
}

function formatArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

export function ToolApprovalDialog({
  isOpen,
  data,
  onApprove,
  onReject,
  className,
}: ToolApprovalDialogProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const toolCall = data.tool_call;
  const riskLevel = getToolRiskLevel(toolCall.name);

  const riskConfig = {
    high: {
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      icon: AlertTriangle,
      label: "High Risk",
      description: "This tool can modify your system or execute commands",
    },
    medium: {
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      icon: Shield,
      label: "Medium Risk",
      description: "This tool can access external resources",
    },
    low: {
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      icon: Info,
      label: "Low Risk",
      description: "This tool has limited access",
    },
  };

  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
      >
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        />

        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            "relative z-10 w-full max-w-lg mx-4 rounded-2xl border-2 bg-background shadow-2xl",
            risk.borderColor,
            className
          )}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <div className="border-b p-6">
            <div className="flex items-start gap-4">
              <div className={cn("rounded-xl p-3", risk.bgColor, risk.color)}>
                <RiskIcon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-lg">Tool Execution Request</h2>
                <p className="text-muted-foreground text-sm">
                  The agent wants to execute a tool that requires your approval
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-3 text-sm",
                risk.bgColor,
                risk.color
              )}
            >
              <span className="font-medium">{risk.label}</span>
              <span className="opacity-50">•</span>
              <span className="opacity-80">{risk.description}</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{toolCall.name}</span>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <button
                  className="flex w-full items-center justify-between text-sm"
                  onClick={() => setShowDetails(!showDetails)}
                  type="button"
                >
                  <span className="font-medium">Arguments</span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <AnimatePresence>
                  {showDetails && (
                    <motion.pre
                      animate={{ height: "auto", opacity: 1 }}
                      className="mt-2 max-h-48 overflow-auto rounded bg-background/50 p-2 font-mono text-xs"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                    >
                      {formatArgs(toolCall.args)}
                    </motion.pre>
                  )}
                </AnimatePresence>
                {!showDetails && (
                  <p className="mt-1 truncate text-muted-foreground text-xs">
                    {Object.keys(toolCall.args).join(", ")}
                  </p>
                )}
              </div>

              {data.all_pending_tools.length > 1 && (
                <div className="text-muted-foreground text-xs">
                  <p className="mb-1 font-medium">Additional tools waiting for approval:</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {data.all_pending_tools.slice(1).map((tool) => (
                      <li key={tool.id}>{tool.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t p-6">
            <Button onClick={onReject} variant="outline">
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={onApprove}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
