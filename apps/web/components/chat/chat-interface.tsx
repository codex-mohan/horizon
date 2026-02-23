"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useConversationStore } from "@/lib/stores/conversation";
import { AnimatedBackground } from "./animated-background";
import { ChatArea } from "./chat-area";
import { DragDropOverlay } from "./drag-drop-overlay";
import { SettingsDialog } from "./settings-dialog";
import { Sidebar } from "./sidebar";

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
  _originalMessage?: unknown;
  reasoning?: string;
  _groupId?: string;
  _isLastInGroup?: boolean;
  _retryTargetId?: string;
  _isIncomplete?: boolean;
}

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  file?: File;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<
    "conversations" | "my-items" | "collections" | "assistants" | null
  >(null);

  const [isDragging, setIsDragging] = useState(false);

  // ---- Global Drag & Drop Handlers ----
  // Only listen for dragenter on the window to show the overlay.
  // The overlay itself will handle the rest (dragover, leave, drop).
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      // Check if files are being dragged
      if (e.dataTransfer?.types && e.dataTransfer.types.indexOf("Files") > -1) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }
    };

    window.addEventListener("dragenter", handleGlobalDragEnter);
    return () => {
      window.removeEventListener("dragenter", handleGlobalDragEnter);
    };
  }, []);

  const handleOverlayDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleOverlayDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (!files || files.length === 0) {
      return;
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    const validFiles: File[] = [];

    files.forEach((file) => {
      if (file.size > MAX_SIZE) {
        toast.error(`File ${file.name} exceeds the 100MB limit.`);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      const newAttachedFiles: AttachedFile[] = validFiles.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file), // Generate local preview URL
        file,
      }));
      setAttachedFiles((prev) => [...prev, ...newAttachedFiles]);
      toast.success(`Attached ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}`);
    }
  }, []);

  const { currentThreadId, setCurrentThreadId } = useConversationStore();

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <DragDropOverlay
        isDragging={isDragging}
        onDragLeave={handleOverlayDragLeave}
        onDrop={handleOverlayDrop}
      />
      <AnimatedBackground />

      <Sidebar
        activeSection={sidebarSection}
        isExpanded={isSidebarExpanded}
        onCollapse={() => setIsSidebarExpanded(false)}
        onSectionChange={(section) => {
          if (section === sidebarSection) {
            setIsSidebarExpanded(!isSidebarExpanded);
          } else {
            setSidebarSection(section);
            setIsSidebarExpanded(true);
          }
        }}
      />

      <ChatArea
        attachedFiles={attachedFiles}
        messages={messages}
        onAttachedFilesChange={setAttachedFiles}
        onMessagesChange={setMessages}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onThreadChange={setCurrentThreadId}
        threadId={currentThreadId}
      />

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
