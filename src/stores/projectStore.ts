import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  ConnectionStatus,
  ConnectionState,
  Schema,
} from "../types";

interface ProjectState {
  projects: Project[];
  connections: Record<string, ConnectionState>;

  // Actions — project CRUD
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Actions — multi-connection
  connectProject: (projectId: string, connectionId: string) => void;
  disconnectProject: (projectId: string) => void;
  setProjectConnectionStatus: (
    projectId: string,
    status: ConnectionStatus
  ) => void;
  setProjectSchemas: (projectId: string, schemas: Schema[]) => void;
  setProjectSchemasLoading: (projectId: string, loading: boolean) => void;
  setProjectError: (projectId: string, error: string | null) => void;

  // Selectors
  getProject: (projectId: string) => Project | undefined;
  getConnection: (projectId: string) => ConnectionState | undefined;
  isProjectConnected: (projectId: string) => boolean;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      connections: {},

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

      deleteProject: (id) => {
        // Delete password from secure keychain
        invoke("delete_password", { projectId: id }).catch(() => {
          // Ignore error if password doesn't exist
        });
        set((state) => {
          const { [id]: _, ...restConnections } = state.connections;
          return {
            projects: state.projects.filter((p) => p.id !== id),
            connections: restConnections,
          };
        });
      },

      connectProject: (projectId, connectionId) =>
        set((state) => ({
          connections: {
            ...state.connections,
            [projectId]: {
              connectionId,
              status: "connected",
              schemas: [],
              schemasLoading: false,
              error: null,
            },
          },
        })),

      disconnectProject: (projectId) =>
        set((state) => {
          const { [projectId]: _, ...rest } = state.connections;
          return { connections: rest };
        }),

      setProjectConnectionStatus: (projectId, status) =>
        set((state) => {
          const conn = state.connections[projectId];
          if (!conn) return state;
          return {
            connections: {
              ...state.connections,
              [projectId]: { ...conn, status },
            },
          };
        }),

      setProjectSchemas: (projectId, schemas) =>
        set((state) => {
          const conn = state.connections[projectId];
          if (!conn) return state;
          return {
            connections: {
              ...state.connections,
              [projectId]: { ...conn, schemas },
            },
          };
        }),

      setProjectSchemasLoading: (projectId, loading) =>
        set((state) => {
          const conn = state.connections[projectId];
          if (!conn) return state;
          return {
            connections: {
              ...state.connections,
              [projectId]: { ...conn, schemasLoading: loading },
            },
          };
        }),

      setProjectError: (projectId, error) =>
        set((state) => {
          const conn = state.connections[projectId];
          if (!conn) return state;
          return {
            connections: {
              ...state.connections,
              [projectId]: { ...conn, error },
            },
          };
        }),

      getProject: (projectId) =>
        get().projects.find((p) => p.id === projectId),

      getConnection: (projectId) => get().connections[projectId],

      isProjectConnected: (projectId) => {
        const conn = get().connections[projectId];
        return conn?.status === "connected" || conn?.status === "reconnecting";
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
