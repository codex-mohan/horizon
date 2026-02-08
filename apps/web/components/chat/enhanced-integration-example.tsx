"use client";

/**
 * Integration Example: Using Enhanced Agent Features in ChatArea
 *
 * This file demonstrates how to integrate the enhanced agent features
 * into the existing ChatArea component.
 */

import { useChat } from "@/lib/chat";
import { ToolApprovalDialog } from "@/components/chat/tool-approval-dialog";
import { useEffect } from "react";
import { toast } from "sonner";

// Example: Enhanced ChatArea integration
export function EnhancedChatAreaExample() {
  const {
    messages,
    isLoading,
    error,
    threadId,
    submit,
    stop,
    // New interrupt-related properties
    interrupt,
    isWaitingForInterrupt,
    approveInterrupt,
    rejectInterrupt,
  } = useChat({
    apiUrl:
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
    assistantId: "enhanced-agent",
    onError: (err) => {
      toast.error(err.message);
    },
    onInterrupt: (data) => {
      // Optional: Custom handling when interrupt is received
      console.log("Interrupt received:", data);

      // You can show a toast notification
      toast.info("Tool approval required", {
        description: `The agent wants to use tool: ${(data as any).tool_call?.name}`,
      });
    },
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error("Chat error:", error);
    }
  }, [error]);

  // Example: Submit a message
  const handleSendMessage = (content: string) => {
    submit({
      messages: [{ type: "human", content }],
    });
  };

  return (
    <div className="relative h-full">
      {/* Your existing ChatArea UI */}

      {/* Messages Display */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg, idx) => (
          <div key={idx}>{/* Render your messages */}</div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <input
          type="text"
          placeholder="Type a message..."
          disabled={isLoading || isWaitingForInterrupt}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isWaitingForInterrupt) {
              handleSendMessage(e.currentTarget.value);
              e.currentTarget.value = "";
            }
          }}
        />

        {/* Show status when waiting for interrupt */}
        {isWaitingForInterrupt && (
          <div className="mt-2 text-sm text-amber-500">
            Waiting for tool approval...
          </div>
        )}

        {isLoading && !isWaitingForInterrupt && (
          <div className="mt-2 text-sm text-muted-foreground">
            Agent is thinking...
          </div>
        )}
      </div>

      {/* Tool Approval Dialog */}
      <ToolApprovalDialog
        isOpen={isWaitingForInterrupt}
        data={interrupt as any}
        onApprove={() => {
          approveInterrupt();
          toast.success("Tool approved");
        }}
        onReject={(reason) => {
          rejectInterrupt(reason);
          toast.info("Tool rejected", {
            description: reason || "No reason provided",
          });
        }}
      />
    </div>
  );
}

/**
 * Configuration Example
 *
 * You can configure the enhanced agent per-thread by passing
 * configuration in the submit options:
 */
export function ConfigurationExample() {
  const { submit } = useChat({
    apiUrl: "http://localhost:2024",
    assistantId: "enhanced-agent",
  });

  const sendWithConfig = () => {
    submit(
      {
        messages: [{ type: "human", content: "Delete all files" }],
      },
      {
        metadata: {
          // Configure which tools require approval for this thread
          requires_approval: ["shell_execute", "file_delete", "file_write"],

          // Enable/disable reasoning
          enable_reasoning: true,

          // Enable/disable interrupts
          enable_interrupt: true,

          // Set limits
          max_model_calls: 10,
        },
      },
    );
  };

  return <button onClick={sendWithConfig}>Send with Config</button>;
}

/**
 * Advanced: Custom Interrupt Handling
 *
 * For more control, you can handle interrupts manually:
 */
export function CustomInterruptHandlingExample() {
  const { stream, interrupt, isWaitingForInterrupt } = useChat({
    apiUrl: "http://localhost:2024",
    assistantId: "enhanced-agent",
  });

  const customApprove = () => {
    // Custom approval logic
    console.log("Custom approve logic");

    // You can add custom validation here
    const toolName = (interrupt as any)?.tool_call?.name;
    if (toolName === "shell_execute") {
      const args = (interrupt as any)?.tool_call?.args;
      if (args?.command?.includes("rm -rf")) {
        toast.error("Cannot approve dangerous command");
        return;
      }
    }

    // Approve via stream command
    stream.submit(undefined, {
      command: { resume: "approved" },
    });
  };

  const customReject = (reason?: string) => {
    // Custom rejection logic
    console.log("Custom reject logic:", reason);

    // Reject via stream command
    stream.submit(undefined, {
      command: { resume: reason || "rejected" },
    });
  };

  return (
    <ToolApprovalDialog
      isOpen={isWaitingForInterrupt}
      data={interrupt as any}
      onApprove={customApprove}
      onReject={customReject}
    />
  );
}

/**
 * Environment Variables Setup
 * 
 * Add these to your apps/backend/.env file:
 
# Feature Flags
ENABLE_PII_DETECTION=true
ENABLE_RATE_LIMITING=true
ENABLE_TOKEN_TRACKING=true
ENABLE_TOOL_RETRY=true
ENABLE_TOOL_APPROVAL=true

# Tool Approval - comma-separated list of tool names
TOOLS_REQUIRE_APPROVAL=shell_execute,file_write,file_delete,system_command

# Limits
MAX_MODEL_CALLS=10
MAX_TOOL_CALLS=20
MAX_RETRIES=3
RATE_LIMIT_WINDOW=60

# Retry Settings
BACKOFF_FACTOR=2.0
INITIAL_DELAY=1.0

# Model Configuration
MODEL_PROVIDER=groq
MODEL_NAME=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_API_KEY=your_key_here

 */

/**
 * Testing the Enhanced Features
 *
 * 1. Test Tool Approval:
 *    - Send: "Execute the command: ls -la"
 *    - Should show approval dialog for shell_execute
 *    - Approve to see results
 *
 * 2. Test ReAct Reasoning:
 *    - Send: "What is 15 * 23?"
 *    - Should show reasoning in backend logs
 *
 * 3. Test Retry Logic:
 *    - Temporarily break a tool
 *    - Should retry up to MAX_RETRIES times
 *
 * 4. Test PII Detection:
 *    - Send: "My email is test@example.com"
 *    - Should log PII detection warning
 *
 * 5. Test Rate Limiting:
 *    - Send many requests quickly
 *    - Should rate limit after threshold
 *
 * 6. Check Metrics:
 *    - GET http://localhost:2024/config
 *    - Shows all enabled features
 */

export default EnhancedChatAreaExample;
