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
    console.log("Branch options:", branchOptions)

    if (!branchOptions || !branch) return <p>No Branches found</p>;
    const index = branchOptions.indexOf(branch);



    return (
        <div className="flex items-center gap-2 text-muted-foreground">
            <button
                type="button"
                disabled={index <= 0}
                onClick={() => onSelect(branchOptions[index - 1])}
                className="hover:text-foreground disabled:opacity-50 transition-colors"
                aria-label="Previous branch"
            >
                ←
            </button>
            <span className="text-xs font-mono">{index + 1} / {branchOptions.length}</span>
            <button
                type="button"
                disabled={index >= branchOptions.length - 1}
                onClick={() => onSelect(branchOptions[index + 1])}
                className="hover:text-foreground disabled:opacity-50 transition-colors"
                aria-label="Next branch"
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
        if (!input.trim()) return;

        stream.submit({ messages: [{ type: "human", content: input }] });
        setInput("");
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground p-4 md:p-6">
            <div className="flex-1 overflow-y-auto mb-4 space-y-6 custom-scrollbar pr-2">
                {stream.messages.map((message) => {
                    const meta = stream.getMessagesMetadata(message);
                    const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
                    const isUser = message.type === 'human';

                    return (
                        <div
                            key={message.id}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                        >
                            <div className={`
                                max-w-[85%] rounded-2xl p-4 shadow-sm
                                ${isUser
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/50 border border-border text-foreground'
                                }
                            `}>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.content as string}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-2 px-1">
                                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground opacity-70">
                                    {message.type}
                                </div>

                                {/* Edit human messages */}
                                {isUser && (
                                    <button
                                        onClick={() => {
                                            const newContent = prompt("Edit message:", message.content as string);
                                            if (newContent) {
                                                stream.submit(
                                                    { messages: [{ type: "human", content: newContent }] },
                                                    { checkpoint: parentCheckpoint }
                                                );
                                            }
                                        }}
                                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        Edit
                                    </button>
                                )}

                                {/* Regenerate AI messages */}
                                {!isUser && (
                                    <button
                                        onClick={() => stream.submit(undefined, { checkpoint: parentCheckpoint })}
                                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
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

            <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto w-full">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
                <button
                    type="submit"
                    disabled={stream.isLoading}
                    className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    {stream.isLoading ? "Sending..." : "Send"}
                </button>
            </form>
        </div>
    );
}