import { create } from "zustand";
import type { Tab } from "../types";

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // Column widths per table (key: "schema.table")
  columnWidths: Record<string, Record<string, number>>;

  // Expanded schemas in sidebar (persists across schema refresh)
  expandedSchemas: Set<string>;

  // Command palette
  commandPaletteOpen: boolean;

  // Project spotlight
  projectSpotlightOpen: boolean;

  // Modals
  projectModalOpen: boolean;
  editingProjectId: string | null;
  stagedChangesOpen: boolean;
  createTableModalOpen: boolean;
  createTableSchema: string | null;

  // Theme
  theme: "dark" | "light";

  // Actions
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  toggleCommandPalette: () => void;
  toggleProjectSpotlight: () => void;
  closeProjectSpotlight: () => void;
  openProjectModal: (projectId?: string) => void;
  closeProjectModal: () => void;
  toggleStagedChanges: () => void;
  openCreateTableModal: (schema?: string) => void;
  closeCreateTableModal: () => void;
  addCreateTableTab: (schema?: string) => void;
  setTheme: (theme: "dark" | "light") => void;
  getColumnWidths: (tableKey: string) => Record<string, number>;
  setColumnWidth: (tableKey: string, columnName: string, width: number) => void;
  resetColumnWidths: (tableKey: string) => void;
  toggleSchemaExpanded: (schemaName: string) => void;
  isSchemaExpanded: (schemaName: string) => boolean;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: 260,
  tabs: [],
  activeTabId: null,
  columnWidths: {},
  expandedSchemas: new Set<string>(),
  commandPaletteOpen: false,
  projectSpotlightOpen: false,
  projectModalOpen: false,
  editingProjectId: null,
  stagedChangesOpen: false,
  createTableModalOpen: false,
  createTableSchema: null,
  theme: "dark",

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  addTab: (tab) =>
    set((state) => {
      // Check if tab already exists
      const existing = state.tabs.find(
        (t) => t.type === tab.type && t.table === tab.table && t.schema === tab.schema
      );
      if (existing) {
        return { activeTabId: existing.id };
      }
      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;

      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          newActiveId = newTabs[Math.min(index, newTabs.length - 1)].id;
        } else {
          newActiveId = null;
        }
      }

      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  toggleProjectSpotlight: () =>
    set((state) => ({ projectSpotlightOpen: !state.projectSpotlightOpen })),

  closeProjectSpotlight: () => set({ projectSpotlightOpen: false }),

  openProjectModal: (projectId) =>
    set({ projectModalOpen: true, editingProjectId: projectId ?? null }),

  closeProjectModal: () =>
    set({ projectModalOpen: false, editingProjectId: null }),

  toggleStagedChanges: () =>
    set((state) => ({ stagedChangesOpen: !state.stagedChangesOpen })),

  openCreateTableModal: (schema) =>
    set({ createTableModalOpen: true, createTableSchema: schema ?? null }),

  closeCreateTableModal: () =>
    set({ createTableModalOpen: false, createTableSchema: null }),

  addCreateTableTab: (schema) =>
    set((state) => {
      // Check if a create-table tab already exists
      const existing = state.tabs.find((t) => t.type === "create-table");
      if (existing) {
        // Update the existing tab's schema and make it active
        return {
          tabs: state.tabs.map((t) =>
            t.id === existing.id ? { ...t, createTableSchema: schema } : t
          ),
          activeTabId: existing.id,
        };
      }
      // Create a new create-table tab
      const newTab: Tab = {
        id: `create-table-${Date.now()}`,
        type: "create-table",
        title: "New Table",
        createTableSchema: schema,
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }),

  setTheme: (theme) => set({ theme }),

  getColumnWidths: (tableKey) => get().columnWidths[tableKey] || {},

  setColumnWidth: (tableKey, columnName, width) =>
    set((state) => ({
      columnWidths: {
        ...state.columnWidths,
        [tableKey]: {
          ...state.columnWidths[tableKey],
          [columnName]: width,
        },
      },
    })),

  resetColumnWidths: (tableKey) =>
    set((state) => {
      const { [tableKey]: _, ...rest } = state.columnWidths;
      return { columnWidths: rest };
    }),

  toggleSchemaExpanded: (schemaName) =>
    set((state) => {
      const newExpanded = new Set(state.expandedSchemas);
      if (newExpanded.has(schemaName)) {
        newExpanded.delete(schemaName);
      } else {
        newExpanded.add(schemaName);
      }
      return { expandedSchemas: newExpanded };
    }),

  isSchemaExpanded: (schemaName) => get().expandedSchemas.has(schemaName),
}));
