"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Shield,
  Terminal,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";

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

interface ToolApprovalBannerProps {
  data: ToolApprovalData;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
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

export function ToolApprovalBanner({
  data,
  onApprove,
  onReject,
  isLoading = false,
}: ToolApprovalBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const toolCall = data.tool_call;
  const riskLevel = getToolRiskLevel(toolCall.name);

  const riskConfig = {
    high: {
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      icon: AlertTriangle,
      label: "High Risk",
    },
    medium: {
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      icon: Shield,
      label: "Medium Risk",
    },
    low: {
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      icon: Info,
      label: "Low Risk",
    },
  };

  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;

  return (
    <div className={cn("rounded-xl border-2 p-4 animate-slide-up", risk.borderColor, risk.bgColor)}>
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2", risk.bgColor, risk.color)}>
          <RiskIcon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                risk.bgColor,
                risk.color
              )}
            >
              {risk.label}
            </span>
            <span className="font-medium text-sm">{toolCall.name}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Terminal className="h-3 w-3" />
            <span className="truncate">
              {Object.keys(toolCall.args).length > 0
                ? Object.entries(toolCall.args)
                    .map(
                      ([k, v]) =>
                        `${k}=${typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)}`
                    )
                    .join(", ")
                : "No arguments"}
            </span>
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => setShowDetails(!showDetails)}
              type="button"
            >
              {showDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>

          {showDetails && (
            <pre className="mt-2 p-2 rounded bg-background/50 text-xs overflow-auto max-h-32 font-mono">
              {formatArgs(toolCall.args)}
            </pre>
          )}

          {data.all_pending_tools.length > 1 && (
            <p className="text-muted-foreground text-xs mt-2">
              +{data.all_pending_tools.length - 1} more tool(s) pending approval
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={isLoading}
              className="h-8"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              Reject
            </Button>
            <Button size="sm" onClick={onApprove} disabled={isLoading} className="h-8">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
