import { create } from "zustand";
import type { Tab } from "../types";

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // Command palette
  commandPaletteOpen: boolean;

  // Modals
  projectModalOpen: boolean;
  editingProjectId: string | null;
  stagedChangesOpen: boolean;

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
  openProjectModal: (projectId?: string) => void;
  closeProjectModal: () => void;
  toggleStagedChanges: () => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  sidebarWidth: 260,
  tabs: [],
  activeTabId: null,
  commandPaletteOpen: false,
  projectModalOpen: false,
  editingProjectId: null,
  stagedChangesOpen: false,
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

  openProjectModal: (projectId) =>
    set({ projectModalOpen: true, editingProjectId: projectId ?? null }),

  closeProjectModal: () =>
    set({ projectModalOpen: false, editingProjectId: null }),

  toggleStagedChanges: () =>
    set((state) => ({ stagedChangesOpen: !state.stagedChangesOpen })),

  setTheme: (theme) => set({ theme }),
}));
