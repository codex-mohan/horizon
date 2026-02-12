"use client";

import { X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { AssistantsView } from "@/components/assistants/assistants-view";
import { ConversationsPanel } from "./conversations-panel";
import { MyItemsPanel } from "./my-items-panel";
import { CollectionsPanel } from "./collections-panel";

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
    <div className="w-80 h-screen glass-strong border-l border-border flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold font-display">{getSectionTitle()}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  );
}
