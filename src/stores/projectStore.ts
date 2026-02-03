import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, ConnectionStatus, Schema } from "../types";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  connectionStatus: ConnectionStatus;
  schemas: Schema[];
  error: string | null;

  // Actions
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSchemas: (schemas: Schema[]) => void;
  setError: (error: string | null) => void;
  getActiveProject: () => Project | undefined;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      connectionStatus: "disconnected",
      schemas: [],
      error: null,

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId:
            state.activeProjectId === id ? null : state.activeProjectId,
        })),

      setActiveProject: (id) => set({ activeProjectId: id }),

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setSchemas: (schemas) => set({ schemas }),

      setError: (error) => set({ error }),

      getActiveProject: () => {
        const state = get();
        return state.projects.find((p) => p.id === state.activeProjectId);
      },
    }),
    {
      name: "tusker-projects",
      partialize: (state) => ({
        projects: state.projects.map((p) => ({
          ...p,
          // Don't persist passwords in plaintext - will be handled by Rust
          connection: { ...p.connection, password: "" },
        })),
      }),
    }
  )
);
