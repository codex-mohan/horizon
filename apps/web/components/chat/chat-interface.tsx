"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { ChatArea } from "./chat-area";
import { SettingsSidebar } from "./settings-sidebar";
import { AnimatedBackground } from "./animated-background";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
  attachments?: AttachedFile[];
  _combinedToolCalls?: Array<{
    id: string;
    name: string;
    arguments?: Record<string, unknown>;
    result?: string;
    status: "loading" | "success" | "error" | "completed";
  }>;
}

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
}

export function ChatInterface() {
  console.log("[v0] ChatInterface rendered");

  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<
    "conversations" | "my-items" | "collections" | "assistants" | null
  >(null);

  return (
    <div className="flex h-screen w-full overflow-hidden relative bg-background">
      <AnimatedBackground />

      <Sidebar
        isExpanded={isSidebarExpanded}
        activeSection={sidebarSection}
        onSectionChange={(section) => {
          if (section === sidebarSection) {
            setIsSidebarExpanded(!isSidebarExpanded);
          } else {
            setSidebarSection(section);
            setIsSidebarExpanded(true);
          }
        }}
        onCollapse={() => setIsSidebarExpanded(false)}
      />

      <ChatArea
        messages={messages}
        attachedFiles={attachedFiles}
        onMessagesChange={setMessages}
        onAttachedFilesChange={setAttachedFiles}
        onSettingsOpen={() => setIsSettingsOpen(true)}
      />

      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
