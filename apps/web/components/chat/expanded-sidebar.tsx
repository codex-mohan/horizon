"use client";

import { Button } from "@workspace/ui/components/button";
import { X } from "lucide-react";
import { AssistantsView } from "@/components/assistants/assistants-view";
import { CollectionsPanel } from "./collections-panel";
import { ConversationsPanel } from "./conversations-panel";
import { MyItemsPanel } from "./my-items-panel";

interface ExpandedSidebarProps {
  section: "conversations" | "my-items" | "collections" | "assistants";
  onClose: () => void;
}

/**
 * ExpandedSidebar - Expanded sidebar with different content sections
 *
 * Features:
 * - Conversations management
 * - My Items (uploaded/generated files)
 * - Collections
 * - Assistants management
 */
export function ExpandedSidebar({ section, onClose }: ExpandedSidebarProps) {
  const getSectionTitle = () => {
    switch (section) {
      case "conversations":
        return "Conversations";
      case "my-items":
        return "My Items";
      case "collections":
        return "Collections";
      case "assistants":
        return "Assistants";
    }
  };

  const renderContent = () => {
    switch (section) {
      case "conversations":
        return <ConversationsPanel onClose={onClose} />;
      case "my-items":
        return <MyItemsPanel />;
      case "collections":
        return <CollectionsPanel />;
      case "assistants":
        return <AssistantsView onClose={onClose} />;
    }
  };

  return (
    <div className="glass-strong flex h-screen w-80 animate-slide-in-right flex-col border-border border-l">
      <div className="flex items-center justify-between border-border border-b p-4">
        <h2 className="font-display font-semibold">{getSectionTitle()}</h2>
        <Button onClick={onClose} size="icon-sm" variant="ghost">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  );
}
