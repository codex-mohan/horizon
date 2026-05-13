import { create } from "zustand";
import { persist } from "zustand/middleware";
import { post, get as apiGet, patch } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<boolean>;
  init: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setTokens: (token: string, refreshToken: string) => void;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,
      isInitialized: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await post<{
            token: string;
            refreshToken: string;
            user: User;
          }>("/v1/auth/login", { email, password });
          set({
            user: res.user,
            token: res.token,
            refreshToken: res.refreshToken,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const res = await post<{
            token: string;
            refreshToken: string;
            user: User;
          }>("/v1/auth/register", { email, password, name });
          set({
            user: res.user,
            token: res.token,
            refreshToken: res.refreshToken,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isInitialized: true,
        });
      },

      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) {
          set({ isAuthenticated: false, isInitialized: true });
          return false;
        }
        try {
          const res = await post<{
            token: string;
            refreshToken: string;
          }>("/v1/auth/refresh", { refreshToken: rt });
          set({
            token: res.token,
            refreshToken: res.refreshToken,
            isAuthenticated: true,
          });
          return true;
        } catch {
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isInitialized: true,
          });
          return false;
        }
      },

      init: async () => {
        const { token, refreshToken } = get();
        if (!token) {
          set({ isInitialized: true });
          return;
        }

        try {
          const user = await apiGet<User>("/v1/me");
          set({ user, isAuthenticated: true, isInitialized: true });
        } catch {
          if (refreshToken) {
            const refreshed = await get().refresh();
            if (refreshed) {
              try {
                const user = await apiGet<User>("/v1/me");
                set({ user, isAuthenticated: true, isInitialized: true });
              } catch {
                set({ isInitialized: true });
              }
            } else {
              set({ isInitialized: true });
            }
          } else {
            set({ isInitialized: true });
          }
        }
      },

      fetchUser: async () => {
        const { token, refresh } = get();
        if (!token) return;
        try {
          const user = await apiGet<User>("/v1/me");
          set({ user, isAuthenticated: true });
        } catch {
          const refreshed = await refresh();
          if (refreshed) {
            try {
              const user = await apiGet<User>("/v1/me");
              set({ user, isAuthenticated: true });
            } catch {
              set({ user: null, isAuthenticated: false });
            }
          } else {
            set({ user: null, isAuthenticated: false });
          }
        }
      },

      setTokens: (token, refreshToken) => {
        set({ token, refreshToken, isAuthenticated: true });
      },

      updateProfile: async (data) => {
        set({ isLoading: true });
        try {
          const user = await patch<User>("/v1/me", data);
          set({ user });
        } finally {
          set({ isLoading: false });
        }
      },

      updatePassword: async (currentPassword, newPassword) => {
        set({ isLoading: true });
        try {
          await post("/v1/me/password", { currentPassword, newPassword });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "horizon-auth",
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
