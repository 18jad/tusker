import { useEffect } from "react";
import { useUIStore } from "../stores/uiStore";

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
  const { toggleCommandPalette, toggleSidebar, closeTab, activeTabId } = useUIStore();

  const bindings: KeyBinding[] = [
    {
      key: "k",
      meta: true,
      handler: () => toggleCommandPalette(),
    },
    {
      key: "k",
      ctrl: true,
      handler: () => toggleCommandPalette(),
    },
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
    {
      key: "w",
      meta: true,
      handler: () => {
        if (activeTabId) closeTab(activeTabId);
      },
    },
    {
      key: "w",
      ctrl: true,
      handler: () => {
        if (activeTabId) closeTab(activeTabId);
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
