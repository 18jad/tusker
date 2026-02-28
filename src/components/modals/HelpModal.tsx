import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { cn, isMac } from "../../lib/utils";
import { listen } from "@tauri-apps/api/event";

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: [isMac ? "⌘" : "Ctrl", "P"], description: "Open project spotlight" },
      { keys: [isMac ? "⌘" : "Ctrl", "B"], description: "Toggle sidebar" },
      { keys: [isMac ? "⌘" : "Ctrl", "W"], description: "Close current tab" },
      { keys: [isMac ? "⌘" : "Ctrl", "/"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Tables",
    shortcuts: [
      { keys: [isMac ? "⌘" : "Ctrl", "N"], description: "New table" },
    ],
  },
  {
    title: "Query Editor",
    shortcuts: [
      { keys: [isMac ? "⌘" : "Ctrl", "T"], description: "New query tab" },
      { keys: [isMac ? "⌘" : "Ctrl", "Enter"], description: "Execute query" },
      { keys: [isMac ? "⌘" : "Ctrl", "Shift", "Enter"], description: "Execute selection" },
      { keys: [isMac ? "⌘" : "Ctrl", "Shift", "F"], description: "Format SQL" },
      { keys: [isMac ? "⌘" : "Ctrl", "S"], description: "Save query" },
    ],
  },
];

export function HelpModal() {
  const { helpModalOpen, closeHelpModal, openHelpModal } = useUIStore();

  // Listen for menu event from Tauri
  useEffect(() => {
    const unlisten = listen("show-keyboard-shortcuts", () => {
      openHelpModal();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openHelpModal]);

  // Also listen for Cmd+/ keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        if (helpModalOpen) {
          closeHelpModal();
        } else {
          openHelpModal();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [helpModalOpen, openHelpModal, closeHelpModal]);

  return (
    <Modal
      open={helpModalOpen}
      onClose={closeHelpModal}
      showCloseButton={false}
      className="max-w-lg"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-[var(--accent)]/10 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Quick reference for all shortcuts
              </p>
            </div>
          </div>
          <button
            onClick={closeHelpModal}
            className={cn(
              "p-1.5 rounded-[4px]",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)]",
              "transition-colors"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-[4px]",
                      "hover:bg-[var(--bg-tertiary)]",
                      "transition-colors"
                    )}
                  >
                    <span className="text-sm text-[var(--text-secondary)]">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className={cn(
                            "px-2 py-1 text-xs font-medium rounded",
                            "bg-[var(--bg-primary)] border border-[var(--border-color)]",
                            "text-[var(--text-secondary)]",
                            "min-w-[24px] text-center"
                          )}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)] text-center">
            Press <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">Esc</kbd> to close
          </p>
        </div>
      </div>
    </Modal>
  );
}
