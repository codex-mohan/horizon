import { create } from "zustand";
import { get as apiGet, post, del } from "@/lib/api";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
}

interface SessionActions {
  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  updateSessionTitle: (id: string, title: string) => void;
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,

  fetchSessions: async () => {
    set({ isLoading: true });
    try {
      const sessions = await apiGet<Session[]>("/v1/sessions");
      set({ sessions });
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (title) => {
    const defaultModel = typeof window !== "undefined"
      ? localStorage.getItem("horizon:default-model")
      : null;
    const session = await post<Session>("/v1/sessions", {
      title: title ?? "New Chat",
      model: defaultModel ?? undefined,
    });
    set({ sessions: [session, ...get().sessions], activeSessionId: session.id });
    return session;
  },

  deleteSession: async (id) => {
    await del(`/v1/sessions/${id}`);
    set({
      sessions: get().sessions.filter((s) => s.id !== id),
      activeSessionId: get().activeSessionId === id ? null : get().activeSessionId,
    });
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  updateSessionTitle: (id, title) => {
    set({
      sessions: get().sessions.map((s) => (s.id === id ? { ...s, title } : s)),
    });
  },
}));
