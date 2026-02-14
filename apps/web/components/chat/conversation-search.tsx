"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import * as React from "react";
import type { Thread } from "@/lib/threads";

interface ConversationSearchProps {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  threads: Thread[];
  onSelect: (threadId: string) => void;
}

export function ConversationSearch({
  open,
  onOpenChange,
  threads,
  onSelect,
}: ConversationSearchProps) {
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandInput placeholder="Search conversations..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Conversations">
          {threads.map((thread) => (
            <CommandItem
              key={thread.thread_id}
              onSelect={() => {
                onSelect(thread.thread_id);
                onOpenChange(false);
              }}
              value={
                (thread.metadata?.title as string) || "Untitled Conversation"
              }
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>
                  {(thread.metadata?.title as string) ||
                    "Untitled Conversation"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(thread.updated_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
