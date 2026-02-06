import { create } from "zustand";
import type { Tab, SortColumn } from "../types";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // Column widths per table (key: "schema.table")
  columnWidths: Record<string, Record<string, number>>;

  // Sort state per table (key: "schema.table") - array for multi-column sort
  tableSortState: Record<string, SortColumn[]>;

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
  deleteTableModal: {
    isOpen: boolean;
    schema: string | null;
    table: string | null;
    rowCount: number | null;
  };
  truncateTableModal: {
    isOpen: boolean;
    schema: string | null;
    table: string | null;
    rowCount: number | null;
  };
  exportTableModal: {
    isOpen: boolean;
    schema: string | null;
    table: string | null;
    rowCount: number | null;
  };

  // Help modal
  helpModalOpen: boolean;

  // Toasts
  toasts: Toast[];

  // Theme
  theme: "dark" | "light";

  // Actions
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
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
  openDeleteTableModal: (schema: string, table: string, rowCount?: number) => void;
  closeDeleteTableModal: () => void;
  openTruncateTableModal: (schema: string, table: string, rowCount?: number) => void;
  closeTruncateTableModal: () => void;
  openExportTableModal: (schema: string, table: string, rowCount?: number) => void;
  closeExportTableModal: () => void;
  addImportDataTab: (schema: string, table: string, format: "csv" | "json") => void;
  addQueryTab: (initialSql?: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  openHelpModal: () => void;
  closeHelpModal: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  dismissToast: (id: string) => void;
  setTheme: (theme: "dark" | "light") => void;
  getColumnWidths: (tableKey: string) => Record<string, number>;
  setColumnWidth: (tableKey: string, columnName: string, width: number) => void;
  resetColumnWidths: (tableKey: string) => void;
  setTableSort: (tableKey: string, sorts: SortColumn[]) => void;
  getTableSort: (tableKey: string) => SortColumn[];
  toggleSchemaExpanded: (schemaName: string) => void;
  isSchemaExpanded: (schemaName: string) => boolean;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: 260,
  tabs: [],
  activeTabId: null,
  columnWidths: {},
  tableSortState: {},
  expandedSchemas: new Set<string>(),
  commandPaletteOpen: false,
  projectSpotlightOpen: false,
  projectModalOpen: false,
  editingProjectId: null,
  stagedChangesOpen: false,
  createTableModalOpen: false,
  createTableSchema: null,
  deleteTableModal: {
    isOpen: false,
    schema: null,
    table: null,
    rowCount: null,
  },
  truncateTableModal: {
    isOpen: false,
    schema: null,
    table: null,
    rowCount: null,
  },
  exportTableModal: {
    isOpen: false,
    schema: null,
    table: null,
    rowCount: null,
  },
  helpModalOpen: false,
  toasts: [],
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

  closeOtherTabs: (id) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    })),

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

  openDeleteTableModal: (schema, table, rowCount) =>
    set({
      deleteTableModal: {
        isOpen: true,
        schema,
        table,
        rowCount: rowCount ?? null,
      },
    }),

  closeDeleteTableModal: () =>
    set({
      deleteTableModal: {
        isOpen: false,
        schema: null,
        table: null,
        rowCount: null,
      },
    }),

  openTruncateTableModal: (schema, table, rowCount) =>
    set({
      truncateTableModal: {
        isOpen: true,
        schema,
        table,
        rowCount: rowCount ?? null,
      },
    }),

  closeTruncateTableModal: () =>
    set({
      truncateTableModal: {
        isOpen: false,
        schema: null,
        table: null,
        rowCount: null,
      },
    }),

  openExportTableModal: (schema, table, rowCount) =>
    set({
      exportTableModal: {
        isOpen: true,
        schema,
        table,
        rowCount: rowCount ?? null,
      },
    }),

  closeExportTableModal: () =>
    set({
      exportTableModal: {
        isOpen: false,
        schema: null,
        table: null,
        rowCount: null,
      },
    }),

  addImportDataTab: (schema, table, format) =>
    set((state) => {
      // Check if an import tab already exists for this table and format
      const existing = state.tabs.find(
        (t) =>
          t.type === "import-data" &&
          t.schema === schema &&
          t.table === table &&
          t.importFormat === format
      );
      if (existing) {
        return { activeTabId: existing.id };
      }
      // Create a new import-data tab
      const newTab = {
        id: `import-${schema}-${table}-${format}-${Date.now()}`,
        type: "import-data" as const,
        title: `Import ${format.toUpperCase()}`,
        schema,
        table,
        importFormat: format,
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }),

  addQueryTab: (initialSql) =>
    set((state) => {
      // Count existing query tabs to generate a unique title
      const queryTabCount = state.tabs.filter((t) => t.type === "query").length;
      const newTab = {
        id: `query-${Date.now()}`,
        type: "query" as const,
        title: `Query ${queryTabCount + 1}`,
        queryContent: initialSql || "",
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex) return state;
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);
      return { tabs: newTabs };
    }),

  openHelpModal: () => set({ helpModalOpen: true }),

  closeHelpModal: () => set({ helpModalOpen: false }),

  showToast: (message, type = "success") => {
    const id = `toast-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

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

  setTableSort: (tableKey, sorts) =>
    set((state) => {
      if (sorts.length === 0) {
        const { [tableKey]: _, ...rest } = state.tableSortState;
        return { tableSortState: rest };
      }
      return {
        tableSortState: {
          ...state.tableSortState,
          [tableKey]: sorts,
        },
      };
    }),

  getTableSort: (tableKey) => get().tableSortState[tableKey] || [],
}));
