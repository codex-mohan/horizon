"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { SettingsSidebar } from "@/components/chat/settings-sidebar";
import { AnimatedBackground } from "@/components/chat/animated-background";
import { useAuthStore } from "@/lib/stores/auth";
import { useConversationStore } from "@/lib/stores/conversation";
import { createThreadsClient } from "@/lib/threads";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Toaster } from "sonner";

import type { Message, AttachedFile } from "@/components/chat/chat-interface";

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const threadId = params.threadId as string;
    const isNewChat = threadId === "new";

    const { user, isInitialized, refreshUser } = useAuthStore();
    const {
        setCurrentThreadId,
        lastCreatedThreadId,
        setLastCreatedThreadId
    } = useConversationStore();

    const [messages, setMessages] = useState<Message[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [sidebarSection, setSidebarSection] = useState<
        "conversations" | "my-items" | "collections" | "assistants" | null
    >(null);

    // Initialize loading state - use sessionStorage to detecting transitions across reloads
    const [isLoading, setIsLoading] = useState(() => {
        if (isNewChat) return false;

        // Check if we just created this thread (persisted across reloads/fast-refresh)
        // Access store directly since we're in initialization
        const storedLastId = useConversationStore.getState().lastCreatedThreadId;
        if (storedLastId === threadId) {
            console.log("[ChatPage] Detected transition from store for:", threadId);
            return false;
        }

        return true;
    });

    const [isValidThread, setIsValidThread] = useState(true);

    // Track the active thread ID to pass to ChatArea
    const [activeThreadId, setActiveThreadId] = useState<string | null>(
        isNewChat ? null : threadId
    );

    // Refresh user on mount
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    // Auth check
    useEffect(() => {
        if (isInitialized && !user) {
            router.push("/auth?redirect=" + encodeURIComponent(`/chat/${threadId}`));
        }
    }, [isInitialized, user, router, threadId]);

    // Handle URL changes and thread validation
    useEffect(() => {
        if (!isInitialized || !user) return;

        // For new chat, just mark as ready
        if (isNewChat) {
            setActiveThreadId(null);
            setCurrentThreadId(null);
            setIsLoading(false);
            setIsValidThread(true);
            return;
        }

        // Check transition from store
        if (lastCreatedThreadId === threadId) {
            console.log("[ChatPage] Validating transition from store");
            // DO NOT update activeThreadId here - keep it as initialized (null if new)
            // to prevent ChatArea prop change which would reset the stream
            setCurrentThreadId(threadId);
            setIsLoading(false);
            setIsValidThread(true);

            // Clear the flag ONLY after we successfully mounted the thread view
            setLastCreatedThreadId(null);
            return;
        }

        // For existing threads, validate they exist and belong to user
        const loadThread = async () => {
            console.log("[ChatPage] Loading thread from API:", threadId);
            setIsLoading(true);
            setIsValidThread(true);

            try {
                const apiUrl =
                    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024";
                const threadsClient = createThreadsClient(apiUrl);
                const thread = await threadsClient.getThread(threadId);

                if (thread) {
                    // Verify thread belongs to this user
                    const threadUserId = thread.metadata?.user_id;
                    if (threadUserId && threadUserId !== user.id) {
                        console.warn("Thread belongs to another user");
                        setIsValidThread(false);
                    } else {
                        setActiveThreadId(threadId);
                        setCurrentThreadId(threadId);
                        setIsValidThread(true);
                    }
                } else {
                    console.warn("Thread not found");
                    setIsValidThread(false);
                }
            } catch (error) {
                console.error("Failed to load thread:", error);
                setIsValidThread(false);
            } finally {
                setIsLoading(false);
            }
        };

        loadThread();
    }, [threadId, isNewChat, isInitialized, user, setCurrentThreadId]);

    // Handle thread creation from ChatArea - update URL when thread is created
    const handleThreadChange = useCallback(
        (newThreadId: string | null) => {
            console.log("[ChatPage] handleThreadChange:", { newThreadId, currentParams: threadId });

            if (newThreadId && newThreadId !== threadId) {
                // Persist transition flag to store (survives refreshes)
                setLastCreatedThreadId(newThreadId);

                // DO NOT update activeThreadId immediately to prevent ChatArea prop change
                // which causes the stream to reset. Keep props stable during transition.
                setCurrentThreadId(newThreadId);

                // Update URL silently to avoid remount
                console.log("[ChatPage] Silently updating URL to:", newThreadId);
                window.history.replaceState(null, "", `/chat/${newThreadId}`);
                // router.replace(`/chat/${newThreadId}`);
            } else if (!newThreadId && threadId !== "new") {
                // Prevent auto-redirect to new if we suspect we are in a transition loop
                console.warn("[ChatPage] Potential redirect loop detected - ignoring redirect to new");
                // router.push("/chat/new"); 
            }
        },
        [threadId, setCurrentThreadId, setLastCreatedThreadId]
    );

    // Handle messages change
    const handleMessagesChange = useCallback((newMessages: Message[]) => {
        setMessages(newMessages);
    }, []);

    // Show loading while checking auth
    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Initializing...</p>
                </motion.div>
            </div>
        );
    }

    // Show loading for existing threads being validated
    if (isLoading && !isNewChat) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading conversation...</p>
                </motion.div>
            </div>
        );
    }

    // Show error for invalid thread
    if (!isNewChat && !isValidThread) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                >
                    <h1 className="text-2xl font-bold">Conversation not found</h1>
                    <p className="text-muted-foreground">
                        This conversation doesn't exist or you don't have access to it.
                    </p>
                    <button
                        onClick={() => router.push("/chat/new")}
                        className="text-primary hover:underline"
                    >
                        Start a new conversation
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            <Toaster
                position="top-right"
                expand={false}
                richColors
                closeButton
                toastOptions={{
                    classNames: {
                        toast: "glass-strong",
                    },
                }}
            />

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
                    onMessagesChange={handleMessagesChange}
                    onAttachedFilesChange={setAttachedFiles}
                    onSettingsOpen={() => setIsSettingsOpen(true)}
                    threadId={activeThreadId}
                    onThreadChange={handleThreadChange}
                />

                <SettingsSidebar
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                />
            </div>
        </>
    );
}
