import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: string;
  success: boolean;
  executionTime?: number;
  rowCount?: number;
}

interface QueryState {
  // Saved queries
  savedQueries: SavedQuery[];

  // Query history (last 100 queries)
  queryHistory: QueryHistoryItem[];

  // Actions
  saveQuery: (query: Omit<SavedQuery, "id" | "createdAt" | "updatedAt">) => string;
  updateQuery: (id: string, updates: Partial<Omit<SavedQuery, "id" | "createdAt">>) => void;
  deleteQuery: (id: string) => void;
  addToHistory: (sql: string, success: boolean, executionTime?: number, rowCount?: number) => void;
  clearHistory: () => void;
  getQueryById: (id: string) => SavedQuery | undefined;
}

const MAX_HISTORY_ITEMS = 100;

export const useQueryStore = create<QueryState>()(
  persist(
    (set, get) => ({
      savedQueries: [],
      queryHistory: [],

      saveQuery: (query) => {
        const id = `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const now = new Date().toISOString();
        const newQuery: SavedQuery = {
          ...query,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          savedQueries: [newQuery, ...state.savedQueries],
        }));
        return id;
      },

      updateQuery: (id, updates) => {
        set((state) => ({
          savedQueries: state.savedQueries.map((q) =>
            q.id === id
              ? { ...q, ...updates, updatedAt: new Date().toISOString() }
              : q
          ),
        }));
      },

      deleteQuery: (id) => {
        set((state) => ({
          savedQueries: state.savedQueries.filter((q) => q.id !== id),
        }));
      },

      addToHistory: (sql, success, executionTime, rowCount) => {
        // Normalize SQL for comparison (trim and collapse whitespace)
        const normalizedSql = sql.trim().replace(/\s+/g, " ");

        set((state) => {
          // Don't add duplicates of the most recent query
          const lastItem = state.queryHistory[0];
          if (lastItem && lastItem.sql.trim().replace(/\s+/g, " ") === normalizedSql) {
            return state;
          }

          const newItem: QueryHistoryItem = {
            id: `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            sql: sql.trim(),
            timestamp: new Date().toISOString(),
            success,
            executionTime,
            rowCount,
          };

          // Keep only the last MAX_HISTORY_ITEMS
          const newHistory = [newItem, ...state.queryHistory].slice(0, MAX_HISTORY_ITEMS);

          return { queryHistory: newHistory };
        });
      },

      clearHistory: () => {
        set({ queryHistory: [] });
      },

      getQueryById: (id) => {
        return get().savedQueries.find((q) => q.id === id);
      },
    }),
    {
      name: "db-viewer-queries",
      partialize: (state) => ({
        savedQueries: state.savedQueries,
        queryHistory: state.queryHistory,
      }),
    }
  )
);
