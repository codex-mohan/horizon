"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    username: string,
    password: string,
    displayName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: {
    displayName?: string;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isInitialized: false,

      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),

      login: async (username, password, rememberMe = false) => {
        set({ isLoading: true });
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, rememberMe }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false });
            return { success: false, error: data.error || "Login failed" };
          }

          set({ user: data.user, isLoading: false });
          return { success: true };
        } catch (_error) {
          set({ isLoading: false });
          return { success: false, error: "Network error. Please try again." };
        }
      },

      register: async (username, password, displayName) => {
        set({ isLoading: true });
        try {
          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, displayName }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false });
            return {
              success: false,
              error: data.error || "Registration failed",
            };
          }

          set({ user: data.user, isLoading: false });
          return { success: true };
        } catch (_error) {
          set({ isLoading: false });
          return { success: false, error: "Network error. Please try again." };
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          set({ user: null, isLoading: false });
          // Force a hard refresh to clear all application state
          if (typeof window !== "undefined") {
            window.location.href = "/auth";
          }
        }
      },

      refreshUser: async () => {
        try {
          const response = await fetch("/api/auth/me");
          const data = await response.json();
          set({ user: data.user || null, isInitialized: true });
        } catch (error) {
          console.error("Failed to refresh user:", error);
          // On network error (e.g. server restart during dev), preserve existing user state
          // to prevent unnecessary redirects
          const currentUser = get().user;
          set({ user: currentUser, isInitialized: true });
        }
      },

      updateProfile: async (updates: { displayName?: string; avatarUrl?: string }) => {
        set({ isLoading: true });
        try {
          const response = await fetch("/api/auth/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false });
            return { success: false, error: data.error || "Update failed" };
          }

          set({ user: data.user, isLoading: false });
          return { success: true };
        } catch (_error) {
          set({ isLoading: false });
          return { success: false, error: "Network error. Please try again." };
        }
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
