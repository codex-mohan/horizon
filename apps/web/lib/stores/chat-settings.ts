import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ToolApprovalMode = "always_ask" | "dangerous_only" | "never_ask";

export interface ChatSettings {
  showToolCalls: boolean;
  showActivityTimeline: boolean;
  toolApprovalMode: ToolApprovalMode;
  autoApproveTools: string[];
  neverApproveTools: string[];
}

interface ChatSettingsState {
  settings: ChatSettings;
  toggleShowToolCalls: () => void;
  toggleShowActivityTimeline: () => void;
  setShowToolCalls: (value: boolean) => void;
  setShowActivityTimeline: (value: boolean) => void;
  setToolApprovalMode: (mode: ToolApprovalMode) => void;
  toggleAutoApproveTool: (toolName: string) => void;
  toggleNeverApproveTool: (toolName: string) => void;
  setAutoApproveTools: (tools: string[]) => void;
  setNeverApproveTools: (tools: string[]) => void;
}

export const useChatSettings = create<ChatSettingsState>()(
  persist(
    (set) => ({
      settings: {
        showToolCalls: true,
        showActivityTimeline: true,
        toolApprovalMode: "dangerous_only",
        autoApproveTools: [],
        neverApproveTools: [],
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
      setToolApprovalMode: (mode: ToolApprovalMode) =>
        set((state) => ({
          settings: {
            ...state.settings,
            toolApprovalMode: mode,
          },
        })),
      toggleAutoApproveTool: (toolName: string) =>
        set((state) => {
          const current = state.settings.autoApproveTools;
          const exists = current.includes(toolName);
          const neverApproveTools = state.settings.neverApproveTools.filter((t) => t !== toolName);
          return {
            settings: {
              ...state.settings,
              autoApproveTools: exists
                ? current.filter((t) => t !== toolName)
                : [...current, toolName],
              neverApproveTools,
            },
          };
        }),
      toggleNeverApproveTool: (toolName: string) =>
        set((state) => {
          const current = state.settings.neverApproveTools;
          const exists = current.includes(toolName);
          const autoApproveTools = state.settings.autoApproveTools.filter((t) => t !== toolName);
          return {
            settings: {
              ...state.settings,
              neverApproveTools: exists
                ? current.filter((t) => t !== toolName)
                : [...current, toolName],
              autoApproveTools,
            },
          };
        }),
      setAutoApproveTools: (tools: string[]) =>
        set((state) => ({
          settings: {
            ...state.settings,
            autoApproveTools: tools,
          },
        })),
      setNeverApproveTools: (tools: string[]) =>
        set((state) => ({
          settings: {
            ...state.settings,
            neverApproveTools: tools,
          },
        })),
    }),
    {
      name: "horizon-chat-settings",
    }
  )
);

export const DANGEROUS_TOOLS = ["shell_execute", "file_write", "file_delete"];

export const SAFE_TOOLS = ["web_search", "fetch_url_content", "duckduckgo_search"];

export const ALL_TOOLS = [...SAFE_TOOLS, ...DANGEROUS_TOOLS];
