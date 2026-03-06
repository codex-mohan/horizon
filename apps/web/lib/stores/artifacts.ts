/**
 * Artifacts Store — Zustand state management for artifacts
 *
 * Manages artifact state per conversation thread with localStorage persistence.
 * Syncs with the server-side API for cross-session durability.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Artifact, ArtifactType } from "@/lib/types/artifact";

interface ArtifactsState {
  /** Artifacts keyed by threadId */
  artifactsByThread: Record<string, Artifact[]>;
  /** Currently active artifact ID (shown in viewer panel) */
  activeArtifactId: string | null;
  /** Whether the viewer panel is open */
  isPanelOpen: boolean;

  // Actions
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  deleteArtifact: (id: string, threadId: string) => void;
  setActiveArtifact: (id: string | null) => void;
  openPanel: (artifactId?: string) => void;
  closePanel: () => void;
  getArtifactsForThread: (threadId: string) => Artifact[];
  getArtifactById: (id: string) => Artifact | undefined;
  setArtifactsForThread: (threadId: string, artifacts: Artifact[]) => void;
}

export const useArtifactsStore = create<ArtifactsState>()(
  persist(
    (set, get) => ({
      artifactsByThread: {},
      activeArtifactId: null,
      isPanelOpen: false,

      addArtifact: (artifact) =>
        set((state) => {
          const threadArtifacts = state.artifactsByThread[artifact.threadId] || [];
          // Check for existing artifact with same title in this thread (version update)
          const existingIndex = threadArtifacts.findIndex(
            (a) => a.title === artifact.title && a.type === artifact.type
          );

          let updatedArtifacts: Artifact[];
          if (existingIndex >= 0) {
            // Update existing — increment version
            updatedArtifacts = [...threadArtifacts];
            updatedArtifacts[existingIndex] = {
              ...artifact,
              id: threadArtifacts[existingIndex].id,
              version: threadArtifacts[existingIndex].version + 1,
              createdAt: threadArtifacts[existingIndex].createdAt,
            };
          } else {
            updatedArtifacts = [...threadArtifacts, artifact];
          }

          return {
            artifactsByThread: {
              ...state.artifactsByThread,
              [artifact.threadId]: updatedArtifacts,
            },
          };
        }),

      updateArtifact: (id, updates) =>
        set((state) => {
          const newByThread = { ...state.artifactsByThread };
          for (const threadId of Object.keys(newByThread)) {
            const idx = newByThread[threadId].findIndex((a) => a.id === id);
            if (idx >= 0) {
              newByThread[threadId] = [...newByThread[threadId]];
              newByThread[threadId][idx] = {
                ...newByThread[threadId][idx],
                ...updates,
                updatedAt: new Date().toISOString(),
              };
              break;
            }
          }
          return { artifactsByThread: newByThread };
        }),

      deleteArtifact: (id, threadId) =>
        set((state) => {
          const threadArtifacts = state.artifactsByThread[threadId] || [];
          return {
            artifactsByThread: {
              ...state.artifactsByThread,
              [threadId]: threadArtifacts.filter((a) => a.id !== id),
            },
            activeArtifactId: state.activeArtifactId === id ? null : state.activeArtifactId,
            isPanelOpen: state.activeArtifactId === id ? false : state.isPanelOpen,
          };
        }),

      setActiveArtifact: (id) =>
        set({
          activeArtifactId: id,
          isPanelOpen: id !== null,
        }),

      openPanel: (artifactId) =>
        set({
          isPanelOpen: true,
          activeArtifactId: artifactId ?? null,
        }),

      closePanel: () =>
        set({
          isPanelOpen: false,
        }),

      getArtifactsForThread: (threadId) => {
        return get().artifactsByThread[threadId] || [];
      },

      getArtifactById: (id) => {
        const allThreads = get().artifactsByThread;
        for (const artifacts of Object.values(allThreads)) {
          const found = artifacts.find((a) => a.id === id);
          if (found) return found;
        }
        return undefined;
      },

      setArtifactsForThread: (threadId, artifacts) =>
        set((state) => ({
          artifactsByThread: {
            ...state.artifactsByThread,
            [threadId]: artifacts,
          },
        })),
    }),
    {
      name: "horizon-artifacts",
      partialize: (state) => ({
        artifactsByThread: state.artifactsByThread,
      }),
    }
  )
);
