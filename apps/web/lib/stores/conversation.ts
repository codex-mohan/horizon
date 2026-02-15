"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationState {
  currentThreadId: string | null;
  lastCreatedThreadId: string | null;
  threadRefreshVersion: number;
  setCurrentThreadId: (threadId: string | null) => void;
  setLastCreatedThreadId: (threadId: string | null) => void;
  triggerThreadRefresh: () => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set) => ({
      currentThreadId: null,
      lastCreatedThreadId: null,
      threadRefreshVersion: 0,
      setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),
      setLastCreatedThreadId: (threadId) => set({ lastCreatedThreadId: threadId }),
      triggerThreadRefresh: () =>
        set((state) => ({ threadRefreshVersion: state.threadRefreshVersion + 1 })),
    }),
    {
      name: "conversation-store",
    }
  )
);
