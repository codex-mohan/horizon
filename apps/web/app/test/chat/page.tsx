"use client";

import { useStream } from "@langchain/langgraph-sdk/react";
import { useState } from "react";

/**
 * Component for navigating between conversation branches.
 * Shows the current branch position and allows switching between alternatives.
 */
function BranchSwitcher({
  branch,
  branchOptions,
  onSelect,
}: {
  branch: string | undefined;
  branchOptions: string[] | undefined;
  onSelect: (branch: string) => void;
}) {
  console.log("Branch:", branch);
  console.log("Branch options:", branchOptions);

  if (!(branchOptions && branch)) {
    return <p>No Branches found</p>;
  }
  const index = branchOptions.indexOf(branch);

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <button
        aria-label="Previous branch"
        className="transition-colors hover:text-foreground disabled:opacity-50"
        disabled={index <= 0}
        onClick={() => onSelect(branchOptions[index - 1])}
        type="button"
      >
        ←
      </button>
      <span className="font-mono text-xs">
        {index + 1} / {branchOptions.length}
      </span>
      <button
        aria-label="Next branch"
        className="transition-colors hover:text-foreground disabled:opacity-50"
        disabled={index >= branchOptions.length - 1}
        onClick={() => onSelect(branchOptions[index + 1])}
        type="button"
      >
        →
      </button>
    </div>
  );
}

export default function ChatPage() {
  const stream = useStream({
    apiUrl: "http://localhost:2024",
    assistantId: "agent",
  });
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      return;
    }

    stream.submit({ messages: [{ type: "human", content: input }] });
    setInput("");
  };

  return (
    <div className="flex h-screen flex-col bg-background p-4 text-foreground md:p-6">
      <div className="custom-scrollbar mb-4 flex-1 space-y-6 overflow-y-auto pr-2">
        {stream.messages.map((message) => {
          const meta = stream.getMessagesMetadata(message);
          const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
          const isUser = message.type === "human";

          return (
            <div
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              key={message.id}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-muted/50 text-foreground"
                }
                            `}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content as string}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 px-1">
                <div className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider opacity-70">
                  {message.type}
                </div>

                {/* Edit human messages */}
                {isUser && (
                  <button
                    className="text-muted-foreground text-xs transition-colors hover:text-primary"
                    onClick={() => {
                      const newContent = prompt(
                        "Edit message:",
                        message.content as string
                      );
                      if (newContent) {
                        stream.submit(
                          {
                            messages: [{ type: "human", content: newContent }],
                          },
                          { checkpoint: parentCheckpoint }
                        );
                      }
                    }}
                  >
                    Edit
                  </button>
                )}

                {/* Regenerate AI messages */}
                {!isUser && (
                  <button
                    className="text-muted-foreground text-xs transition-colors hover:text-primary"
                    onClick={() =>
                      stream.submit(undefined, { checkpoint: parentCheckpoint })
                    }
                  >
                    Regenerate
                  </button>
                )}

                {/* Switch between branches */}
                <BranchSwitcher
                  branch={meta?.branch}
                  branchOptions={meta?.branchOptions}
                  onSelect={(branch) => stream.setBranch(branch)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="mx-auto flex w-full max-w-4xl gap-3"
        onSubmit={handleSubmit}
      >
        <input
          className="flex-1 rounded-xl border border-input bg-background p-3 transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          type="text"
          value={input}
        />
        <button
          className="rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={stream.isLoading}
          type="submit"
        >
          {stream.isLoading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
