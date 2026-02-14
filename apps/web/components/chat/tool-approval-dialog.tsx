"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
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
import React from "react";

export interface ToolApprovalData {
  type: "tool_approval_required";
  tool_call: {
    id: string;
    name: string;
    args: Record<string, any>;
    status: string;
  };
  all_pending_tools: Array<{
    id: string;
    name: string;
    args: Record<string, any>;
    status: string;
  }>;
  auto_execute_tools: Array<{
    id: string;
    name: string;
    args: Record<string, any>;
    status: string;
  }>;
  message: string;
}

interface ToolApprovalDialogProps {
  isOpen: boolean;
  data: ToolApprovalData | null;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  className?: string;
}

/**
 * Get risk level for a tool
 */
function getToolRiskLevel(toolName: string): "low" | "medium" | "high" {
  const highRiskTools = [
    "shell_execute",
    "file_write",
    "file_delete",
    "system_command",
    "execute_code",
  ];
  const mediumRiskTools = ["file_read", "fetch_url_content", "search_web"];

  if (highRiskTools.includes(toolName)) {
    return "high";
  }
  if (mediumRiskTools.includes(toolName)) {
    return "medium";
  }
  return "low";
}

/**
 * Format tool arguments for display
 */
function formatArgs(args: Record<string, any>): string {
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
  const [showDetails, setShowDetails] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);

  if (!data) {
    return null;
  }

  const toolCall = data.tool_call;
  const riskLevel = getToolRiskLevel(toolCall.name);
  const _allTools = [...data.all_pending_tools, ...data.auto_execute_tools];

  const riskConfig = {
    high: {
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      icon: AlertTriangle,
      label: "High Risk",
      description: "This tool can modify your system or execute commands",
    },
    medium: {
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      icon: Shield,
      label: "Medium Risk",
      description: "This tool can access external resources",
    },
    low: {
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      icon: Info,
      label: "Low Risk",
      description: "This tool has limited access",
    },
  };

  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;

  const handleReject = () => {
    if (isRejecting) {
      onReject(rejectionReason || "User rejected tool execution");
      setIsRejecting(false);
      setRejectionReason("");
    } else {
      setIsRejecting(true);
    }
  };

  return (
    <Dialog onOpenChange={() => {}} open={isOpen}>
      <DialogContent
        className={cn("sm:max-w-lg", "border-2", risk.borderColor, className)}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", risk.bgColor, risk.color)}>
              <RiskIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-semibold text-lg">
                Tool Execution Request
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                The agent wants to execute a tool that requires your approval
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Risk Level Badge */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              risk.bgColor,
              risk.color
            )}
          >
            <span className="font-medium">{risk.label}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{risk.description}</span>
          </div>

          {/* Tool Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{toolCall.name}</span>
            </div>

            {/* Arguments Preview */}
            <div className="rounded-lg bg-muted/50 p-3">
              <button
                className="flex w-full items-center justify-between text-sm"
                onClick={() => setShowDetails(!showDetails)}
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

            {/* Message */}
            <p className="text-muted-foreground text-sm">{data.message}</p>

            {/* All Pending Tools */}
            {data.all_pending_tools.length > 1 && (
              <div className="text-muted-foreground text-xs">
                <p className="mb-1 font-medium">
                  Additional tools waiting for approval:
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {data.all_pending_tools.slice(1).map((tool) => (
                    <li key={tool.id}>{tool.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Auto-execute Tools */}
            {data.auto_execute_tools.length > 0 && (
              <div className="text-muted-foreground text-xs">
                <p className="mb-1 font-medium">
                  Tools that will auto-execute:
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {data.auto_execute_tools.map((tool) => (
                    <li key={tool.id}>{tool.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Rejection Reason Input */}
          <AnimatePresence>
            {isRejecting && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="space-y-2"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
              >
                <label className="font-medium text-sm">
                  Reason for rejection (optional)
                </label>
                <textarea
                  className="min-h-[80px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why you're rejecting this tool execution..."
                  value={rejectionReason}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          {isRejecting ? (
            <>
              <Button
                className="gap-2"
                onClick={() => {
                  setIsRejecting(false);
                  setRejectionReason("");
                }}
                variant="outline"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                className="gap-2"
                onClick={handleReject}
                variant="destructive"
              >
                <XCircle className="h-4 w-4" />
                Reject Tool
              </Button>
            </>
          ) : (
            <>
              <Button
                className="gap-2"
                onClick={handleReject}
                variant="outline"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button className="gap-2" onClick={onApprove}>
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
