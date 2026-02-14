import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatSettings {
  showToolCalls: boolean;
  showActivityTimeline: boolean;
}

interface ChatSettingsState {
  settings: ChatSettings;
  toggleShowToolCalls: () => void;
  toggleShowActivityTimeline: () => void;
  setShowToolCalls: (value: boolean) => void;
  setShowActivityTimeline: (value: boolean) => void;
}

export const useChatSettings = create<ChatSettingsState>()(
  persist(
    (set) => ({
      settings: {
        showToolCalls: true,
        showActivityTimeline: true,
      },
      toggleShowToolCalls: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            showToolCalls: !state.settings.showToolCalls,
          },
        })),
      toggleShowActivityTimeline: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            showActivityTimeline: !state.settings.showActivityTimeline,
          },
        })),
      setShowToolCalls: (value: boolean) =>
        set((state) => ({
          settings: {
            ...state.settings,
            showToolCalls: value,
          },
        })),
      setShowActivityTimeline: (value: boolean) =>
        set((state) => ({
          settings: {
            ...state.settings,
            showActivityTimeline: value,
          },
        })),
    }),
    {
      name: "horizon-chat-settings",
    }
  )
);
