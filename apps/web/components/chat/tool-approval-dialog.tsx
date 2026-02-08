"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Terminal,
  Shield,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

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

  if (highRiskTools.includes(toolName)) return "high";
  if (mediumRiskTools.includes(toolName)) return "medium";
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

  if (!data) return null;

  const toolCall = data.tool_call;
  const riskLevel = getToolRiskLevel(toolCall.name);
  const allTools = [...data.all_pending_tools, ...data.auto_execute_tools];

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
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className={cn("sm:max-w-lg", "border-2", risk.borderColor, className)}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", risk.bgColor, risk.color)}>
              <RiskIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Tool Execution Request
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                The agent wants to execute a tool that requires your approval
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Risk Level Badge */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              risk.bgColor,
              risk.color,
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
            <div className="bg-muted/50 rounded-lg p-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-between w-full text-sm"
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
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 text-xs overflow-auto max-h-48 bg-background/50 rounded p-2 font-mono"
                  >
                    {formatArgs(toolCall.args)}
                  </motion.pre>
                )}
              </AnimatePresence>
              {!showDetails && (
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {Object.keys(toolCall.args).join(", ")}
                </p>
              )}
            </div>

            {/* Message */}
            <p className="text-sm text-muted-foreground">{data.message}</p>

            {/* All Pending Tools */}
            {data.all_pending_tools.length > 1 && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">
                  Additional tools waiting for approval:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {data.all_pending_tools.slice(1).map((tool) => (
                    <li key={tool.id}>{tool.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Auto-execute Tools */}
            {data.auto_execute_tools.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">
                  Tools that will auto-execute:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
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
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium">
                  Reason for rejection (optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why you're rejecting this tool execution..."
                  className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          {isRejecting ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejecting(false);
                  setRejectionReason("");
                }}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject Tool
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button onClick={onApprove} className="gap-2">
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
