import { useEffect } from "react";
import { useUIStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

type KeyHandler = (event: KeyboardEvent) => void;

interface KeyBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: KeyHandler;
}

export function useKeyboard(bindings: KeyBinding[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindings) {
        const ctrlMatch = binding.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = binding.meta ? event.metaKey : !event.metaKey;
        const shiftMatch = binding.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
          event.preventDefault();
          binding.handler(event);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings]);
}

// Global keyboard shortcuts
export function useGlobalKeyboardShortcuts() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const closeTab = useUIStore((state) => state.closeTab);
  const addCreateTableTab = useUIStore((state) => state.addCreateTableTab);
  const addQueryTab = useUIStore((state) => state.addQueryTab);

  // Get state inside handlers to avoid stale closures
  const getActiveTabId = () => useUIStore.getState().activeTabId;
  const getConnectionStatus = () => useProjectStore.getState().connectionStatus;

  const bindings: KeyBinding[] = [
    // Cmd/Ctrl+B - Toggle sidebar
    {
      key: "b",
      meta: true,
      handler: () => toggleSidebar(),
    },
    {
      key: "b",
      ctrl: true,
      handler: () => toggleSidebar(),
    },
    // Cmd/Ctrl+W - Close active tab
    {
      key: "w",
      meta: true,
      handler: () => {
        const activeTabId = getActiveTabId();
        if (activeTabId) closeTab(activeTabId);
      },
    },
    {
      key: "w",
      ctrl: true,
      handler: () => {
        const activeTabId = getActiveTabId();
        if (activeTabId) closeTab(activeTabId);
      },
    },
    // Cmd/Ctrl+N - New table tab (only when connected)
    {
      key: "n",
      meta: true,
      handler: () => {
        if (getConnectionStatus() === "connected") {
          addCreateTableTab();
        }
      },
    },
    {
      key: "n",
      ctrl: true,
      handler: () => {
        if (getConnectionStatus() === "connected") {
          addCreateTableTab();
        }
      },
    },
    // Cmd/Ctrl+T - New query tab (only when connected)
    {
      key: "t",
      meta: true,
      handler: () => {
        if (getConnectionStatus() === "connected") {
          addQueryTab();
        }
      },
    },
    {
      key: "t",
      ctrl: true,
      handler: () => {
        if (getConnectionStatus() === "connected") {
          addQueryTab();
        }
      },
    },
  ];

  useKeyboard(bindings);
}

// Hook for escape key handling
export function useEscapeKey(handler: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handler();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handler, enabled]);
}

// Hook for click outside detection
export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, handler, enabled]);
}
