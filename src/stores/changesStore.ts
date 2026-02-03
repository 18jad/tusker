import { create } from "zustand";
import type { StagedChange, Row } from "../types";

interface ChangesState {
  changes: StagedChange[];

  // Actions
  addChange: (change: Omit<StagedChange, "id">) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;
  getChangesForTable: (schema: string, table: string) => StagedChange[];
  hasChanges: () => boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useChangesStore = create<ChangesState>((set, get) => ({
  changes: [],

  addChange: (change) =>
    set((state) => {
      // For updates, merge with existing change if same row
      if (change.type === "update" && change.originalData) {
        const primaryKey = findPrimaryKeyValue(change.data, change.originalData);
        const existingIndex = state.changes.findIndex(
          (c) =>
            c.type === "update" &&
            c.schema === change.schema &&
            c.table === change.table &&
            findPrimaryKeyValue(c.data, c.originalData) === primaryKey
        );

        if (existingIndex !== -1) {
          const updated = [...state.changes];
          updated[existingIndex] = {
            ...updated[existingIndex],
            data: { ...updated[existingIndex].data, ...change.data },
            sql: change.sql,
          };
          return { changes: updated };
        }
      }

      return {
        changes: [...state.changes, { ...change, id: generateId() }],
      };
    }),

  removeChange: (id) =>
    set((state) => ({
      changes: state.changes.filter((c) => c.id !== id),
    })),

  clearChanges: () => set({ changes: [] }),

  getChangesForTable: (schema, table) => {
    return get().changes.filter(
      (c) => c.schema === schema && c.table === table
    );
  },

  hasChanges: () => get().changes.length > 0,
}));

function findPrimaryKeyValue(data: Row, original?: Row): string {
  // Simple heuristic: use 'id' field or first field
  const row = original || data;
  if ("id" in row) return String(row.id);
  const firstKey = Object.keys(row)[0];
  return firstKey ? String(row[firstKey]) : "";
}
