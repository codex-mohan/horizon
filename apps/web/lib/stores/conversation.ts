"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationState {
    currentThreadId: string | null;
    lastCreatedThreadId: string | null;
    setCurrentThreadId: (threadId: string | null) => void;
    setLastCreatedThreadId: (threadId: string | null) => void;
}

export const useConversationStore = create<ConversationState>()(
    persist(
        (set) => ({
            currentThreadId: null,
            lastCreatedThreadId: null,
            setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),
            setLastCreatedThreadId: (threadId) => set({ lastCreatedThreadId: threadId }),
        }),
        {
            name: "conversation-store",
        }
    )
);
