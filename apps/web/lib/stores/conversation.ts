"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationState {
    currentThreadId: string | null;
    setCurrentThreadId: (threadId: string | null) => void;
}

export const useConversationStore = create<ConversationState>()(
    persist(
        (set) => ({
            currentThreadId: null,
            setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),
        }),
        {
            name: "conversation-store",
        }
    )
);
