import { create } from "zustand";
import type { Tab, SortColumn, FilterCondition } from "../types";

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

  // Filter state per table (key: "schema.table")
  tableFilterState: Record<string, FilterCondition[]>;

  // Expanded schemas in sidebar (persists across schema refresh)
  expandedSchemas: Set<string>;

  // Command palette
  commandPaletteOpen: boolean;

  // Project spotlight
  projectSpotlightOpen: boolean;

  // Modals
  projectModalOpen: boolean;
  editingProjectId: string | null;
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

  // Delete project modal
  deleteProjectModal: {
    isOpen: boolean;
    projectId: string | null;
  };

  // Schema info modal
  schemaInfoModal: {
    isOpen: boolean;
    schema: string | null;
  };

  // Create schema modal
  createSchemaModalOpen: boolean;

  // Drop schema modal
  dropSchemaModal: {
    isOpen: boolean;
    schema: string | null;
    tableCount: number | null;
  };

  // Export/Import connections modals
  exportModalOpen: boolean;
  importModalOpen: boolean;

  // Discovery modal
  discoveryModalOpen: boolean;

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
  openCreateTableModal: (schema?: string) => void;
  closeCreateTableModal: () => void;
  addCreateTableTab: (schema?: string) => void;
  addEditTableTab: (schema: string, table: string) => void;
  openDeleteTableModal: (schema: string, table: string, rowCount?: number) => void;
  closeDeleteTableModal: () => void;
  openTruncateTableModal: (schema: string, table: string, rowCount?: number) => void;
  closeTruncateTableModal: () => void;
  openExportTableModal: (schema: string, table: string, rowCount?: number) => void;
  closeExportTableModal: () => void;
  addImportDataTab: (schema: string, table: string, format: "csv" | "json") => void;
  addQueryTab: (initialSql?: string) => void;
  addHistoryTab: () => void;
  addStagedChangesTab: () => void;
  addDiagramTab: (schema?: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  openDeleteProjectModal: (projectId: string) => void;
  closeDeleteProjectModal: () => void;
  openSchemaInfoModal: (schema: string) => void;
  closeSchemaInfoModal: () => void;
  openCreateSchemaModal: () => void;
  closeCreateSchemaModal: () => void;
  openDropSchemaModal: (schema: string, tableCount?: number) => void;
  closeDropSchemaModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  openImportModal: () => void;
  closeImportModal: () => void;
  openDiscoveryModal: () => void;
  closeDiscoveryModal: () => void;
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
  setTableFilters: (tableKey: string, filters: FilterCondition[]) => void;
  getTableFilters: (tableKey: string) => FilterCondition[];
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
  tableFilterState: {},
  expandedSchemas: new Set<string>(),
  commandPaletteOpen: false,
  projectSpotlightOpen: false,
  projectModalOpen: false,
  editingProjectId: null,
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
  deleteProjectModal: {
    isOpen: false,
    projectId: null,
  },
  schemaInfoModal: {
    isOpen: false,
    schema: null,
  },
  createSchemaModalOpen: false,
  dropSchemaModal: {
    isOpen: false,
    schema: null,
    tableCount: null,
  },
  exportModalOpen: false,
  importModalOpen: false,
  discoveryModalOpen: false,
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
      const tabToClose = state.tabs.find((t) => t.id === id);
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;

      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          newActiveId = newTabs[Math.min(index, newTabs.length - 1)].id;
        } else {
          newActiveId = null;
        }
      }

      // Clean up filters, sorts, and column widths for table tabs
      if (tabToClose?.type === "table" && tabToClose.schema && tabToClose.table) {
        const tableKey = `${tabToClose.schema}.${tabToClose.table}`;
        const { [tableKey]: _, ...remainingFilters } = state.tableFilterState;
        const { [tableKey]: __, ...remainingSorts } = state.tableSortState;
        const { [tableKey]: ___, ...remainingWidths } = state.columnWidths;

        return {
          tabs: newTabs,
          activeTabId: newActiveId,
          tableFilterState: remainingFilters,
          tableSortState: remainingSorts,
          columnWidths: remainingWidths,
        };
      }

      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  closeAllTabs: () =>
    set({
      tabs: [],
      activeTabId: null,
      tableFilterState: {},
      tableSortState: {},
      columnWidths: {},
    }),

  closeOtherTabs: (id) =>
    set((state) => {
      const remainingTab = state.tabs.find((t) => t.id === id);
      const closingTabs = state.tabs.filter((t) => t.id !== id);

      // Clean up state for all closing table tabs
      let newFilterState = { ...state.tableFilterState };
      let newSortState = { ...state.tableSortState };
      let newWidthState = { ...state.columnWidths };

      closingTabs.forEach((tab) => {
        if (tab.type === "table" && tab.schema && tab.table) {
          const tableKey = `${tab.schema}.${tab.table}`;
          delete newFilterState[tableKey];
          delete newSortState[tableKey];
          delete newWidthState[tableKey];
        }
      });

      return {
        tabs: [remainingTab].filter(Boolean) as Tab[],
        activeTabId: id,
        tableFilterState: newFilterState,
        tableSortState: newSortState,
        columnWidths: newWidthState,
      };
    }),

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

  addHistoryTab: () =>
    set((state) => {
      const existing = state.tabs.find((t) => t.type === "history");
      if (existing) {
        return { activeTabId: existing.id };
      }
      const newTab: Tab = {
        id: `history-${Date.now()}`,
        type: "history",
        title: "Commit History",
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }),

  addStagedChangesTab: () =>
    set((state) => {
      const existing = state.tabs.find((t) => t.type === "staged-changes");
      if (existing) {
        return { activeTabId: existing.id };
      }
      const newTab: Tab = {
        id: `staged-changes-${Date.now()}`,
        type: "staged-changes",
        title: "Staged Changes",
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }),

  addDiagramTab: (schema?: string) =>
    set((state) => {
      const existing = state.tabs.find(
        (t) => t.type === "diagram" && t.schema === schema,
      );
      if (existing) {
        return { activeTabId: existing.id };
      }
      const newTab: Tab = {
        id: `diagram-${Date.now()}`,
        type: "diagram",
        title: schema ? `${schema} Diagram` : "Schema Diagram",
        schema,
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

  pinTab: (id) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab || tab.pinned) return state;
      // Mark as pinned and move to end of pinned group
      const pinned = state.tabs.filter((t) => t.pinned);
      const unpinned = state.tabs.filter((t) => !t.pinned && t.id !== id);
      return { tabs: [...pinned, { ...tab, pinned: true }, ...unpinned] };
    }),

  unpinTab: (id) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab || !tab.pinned) return state;
      // Unpin and move to start of unpinned group
      const pinned = state.tabs.filter((t) => t.pinned && t.id !== id);
      const unpinned = state.tabs.filter((t) => !t.pinned);
      return { tabs: [...pinned, { ...tab, pinned: false }, ...unpinned] };
    }),

  openDeleteProjectModal: (projectId) =>
    set({ deleteProjectModal: { isOpen: true, projectId } }),

  closeDeleteProjectModal: () =>
    set({ deleteProjectModal: { isOpen: false, projectId: null } }),

  openSchemaInfoModal: (schema) =>
    set({ schemaInfoModal: { isOpen: true, schema } }),

  closeSchemaInfoModal: () =>
    set({ schemaInfoModal: { isOpen: false, schema: null } }),

  openCreateSchemaModal: () => set({ createSchemaModalOpen: true }),
  closeCreateSchemaModal: () => set({ createSchemaModalOpen: false }),

  openDropSchemaModal: (schema, tableCount) =>
    set({
      dropSchemaModal: {
        isOpen: true,
        schema,
        tableCount: tableCount ?? null,
      },
    }),

  closeDropSchemaModal: () =>
    set({
      dropSchemaModal: {
        isOpen: false,
        schema: null,
        tableCount: null,
      },
    }),

  openExportModal: () => set({ exportModalOpen: true }),
  closeExportModal: () => set({ exportModalOpen: false }),
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),
  openDiscoveryModal: () => set({ discoveryModalOpen: true }),
  closeDiscoveryModal: () => set({ discoveryModalOpen: false }),

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

  addEditTableTab: (schema, table) =>
    set((state) => {
      // Check if an edit-table tab already exists for this table
      const existing = state.tabs.find(
        (t) => t.type === "edit-table" && t.schema === schema && t.table === table
      );
      if (existing) {
        return { activeTabId: existing.id };
      }
      const newTab: Tab = {
        id: `edit-table-${schema}-${table}-${Date.now()}`,
        type: "edit-table",
        title: `Edit: ${table}`,
        schema,
        table,
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

  setTableFilters: (tableKey, filters) =>
    set((state) => {
      if (filters.length === 0) {
        const { [tableKey]: _, ...rest } = state.tableFilterState;
        return { tableFilterState: rest };
      }
      return {
        tableFilterState: {
          ...state.tableFilterState,
          [tableKey]: filters,
        },
      };
    }),

  getTableFilters: (tableKey) => get().tableFilterState[tableKey] || [],
}));
