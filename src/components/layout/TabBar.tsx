import { useRef, useState, useEffect, useCallback } from "react";
import { X, Table2, FileCode, ChevronLeft, ChevronRight, Database, FileUp, Pencil, XCircle } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { ContextMenu } from "../ui/ContextMenu";
import { cn } from "../../lib/utils";
import type { Tab } from "../../types";

function getTabIcon(type: Tab["type"]) {
  switch (type) {
    case "table":
      return Table2;
    case "query":
      return FileCode;
    case "create-table":
      return Database;
    case "import-data":
      return FileUp;
    default:
      return FileCode;
  }
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  tabCount: number;
}

function TabItem({
  tab,
  isActive,
  isRenaming,
  renameValue,
  onActivate,
  onClose,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onCloseOthers,
  onCloseAll,
  tabCount,
}: TabItemProps) {
  const Icon = getTabIcon(tab.type);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onRenameSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onRenameCancel();
    }
  };

  const contextMenuItems = [
    {
      label: "Rename",
      icon: <Pencil className="w-3.5 h-3.5" />,
      onClick: onRenameStart,
    },
    { type: "separator" as const },
    {
      label: "Close",
      icon: <X className="w-3.5 h-3.5" />,
      onClick: (e?: React.MouseEvent) => {
        const mouseEvent = e || ({ stopPropagation: () => {} } as React.MouseEvent);
        onClose(mouseEvent);
      },
    },
    {
      label: "Close Others",
      icon: <XCircle className="w-3.5 h-3.5" />,
      onClick: onCloseOthers,
      disabled: tabCount <= 1,
    },
    {
      label: "Close All",
      onClick: onCloseAll,
      variant: "danger" as const,
    },
  ];

  return (
    <ContextMenu items={contextMenuItems}>
      <div
        role="tab"
        tabIndex={0}
        onClick={onActivate}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onRenameStart();
        }}
        onKeyDown={(e) => e.key === "Enter" && onActivate()}
        className={cn(
          "group flex items-center gap-2 px-3 h-10 min-w-[120px] max-w-[200px]",
          "border-r border-[var(--border-color)]",
          "transition-colors duration-150 shrink-0 cursor-grab active:cursor-grabbing",
          isActive
            ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
        )}
      >
        <Icon className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "flex-1 min-w-0 px-1 py-0.5 text-sm rounded",
              "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
              "border border-[var(--accent)] outline-none",
              "focus:ring-1 focus:ring-[var(--accent)]"
            )}
          />
        ) : (
          <span className="truncate text-sm select-none">{tab.title}</span>
        )}
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "ml-auto p-0.5 rounded shrink-0",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-[var(--border-color)]",
            "transition-opacity duration-150"
          )}
          aria-label={`Close ${tab.title}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </ContextMenu>
  );
}

export function TabBar() {
  const tabs = useUIStore((state) => state.tabs);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const closeTab = useUIStore((state) => state.closeTab);
  const closeOtherTabs = useUIStore((state) => state.closeOtherTabs);
  const closeAllTabs = useUIStore((state) => state.closeAllTabs);
  const updateTab = useUIStore((state) => state.updateTab);
  const reorderTabs = useUIStore((state) => state.reorderTabs);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Rename state
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [ghostStyle, setGhostStyle] = useState<React.CSSProperties | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<number>(0);
  const dragWidthRef = useRef<number>(0);

  const handleRenameStart = useCallback((tab: Tab) => {
    setRenamingTabId(tab.id);
    setRenameValue(tab.title);
  }, []);

  const handleRenameSubmit = useCallback((tabId: string) => {
    if (renameValue.trim()) {
      updateTab(tabId, { title: renameValue.trim() });
    }
    setRenamingTabId(null);
    setRenameValue("");
  }, [renameValue, updateTab]);

  const handleRenameCancel = useCallback(() => {
    setRenamingTabId(null);
    setRenameValue("");
  }, []);

  const checkScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  }, []);

  useEffect(() => {
    checkScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollState);
      const resizeObserver = new ResizeObserver(checkScrollState);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener("scroll", checkScrollState);
        resizeObserver.disconnect();
      };
    }
  }, [checkScrollState, tabs.length]);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (!activeTabId) return;
    const index = tabs.findIndex((t) => t.id === activeTabId);
    if (index === -1) return;
    const tabEl = tabRefs.current[index];
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId, tabs]);

  const handleScroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = 200;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    // Only start drag on left click and not on close button
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const tabEl = tabRefs.current[index];
    if (!tabEl) return;
    const tabRect = tabEl.getBoundingClientRect();

    // Store in ref for access in mouseup handler
    dragIndexRef.current = index;
    dragOffsetRef.current = e.clientX - tabRect.left;
    dragWidthRef.current = tabRect.width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Start drag only after moving a few pixels (to allow clicks)
      if (!isDragging) {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (dx > 5 || dy > 5) {
          isDragging = true;
          setDragIndex(index);
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
      }

      if (!isDragging) return;

      // Position the ghost to follow the cursor
      setGhostStyle({
        position: "fixed",
        left: moveEvent.clientX - dragOffsetRef.current,
        top: tabRect.top,
        width: tabRect.width,
        height: tabRect.height,
      });

      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const mouseX = moveEvent.clientX - containerRect.left + container.scrollLeft;

      // Find drop position based on centers of other tabs (skip dragged tab)
      let newDropIndex = tabs.length;
      for (let i = 0; i < tabRefs.current.length; i++) {
        const el = tabRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const elLeft = r.left - containerRect.left + container.scrollLeft;
        const elCenter = elLeft + r.width / 2;
        if (mouseX < elCenter) {
          newDropIndex = i;
          break;
        }
      }

      // Normalize: dropping at index or index+1 means no move
      if (newDropIndex === index || newDropIndex === index + 1) {
        dropIndexRef.current = null;
        setDropIndex(null);
      } else {
        dropIndexRef.current = newDropIndex;
        setDropIndex(newDropIndex);
      }
    };

    const handleMouseUp = () => {
      const fromIndex = dragIndexRef.current;
      const toIndex = dropIndexRef.current;

      if (isDragging && fromIndex !== null && toIndex !== null) {
        const adjustedDropIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
        if (adjustedDropIndex !== fromIndex) {
          reorderTabs(fromIndex, adjustedDropIndex);
        }
      }

      // Reset state
      dragIndexRef.current = null;
      dropIndexRef.current = null;
      setDragIndex(null);
      setDropIndex(null);
      setGhostStyle(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  /** Compute translateX for each tab to shift around the dragged tab */
  const getTabTransform = (index: number): React.CSSProperties => {
    if (dragIndex === null || dropIndex === null) return {};
    const w = dragWidthRef.current;
    // Effective drop target (where the gap appears)
    const target = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
    if (index === dragIndex) return {};
    if (target > dragIndex) {
      // Dragging right: shift tabs between (dragIndex+1..target) left
      if (index > dragIndex && index <= target) return { transform: `translateX(-${w}px)`, transition: "transform 200ms ease" };
    } else {
      // Dragging left: shift tabs between (target..dragIndex-1) right
      if (index >= target && index < dragIndex) return { transform: `translateX(${w}px)`, transition: "transform 200ms ease" };
    }
    return { transition: "transform 200ms ease" };
  };

  if (tabs.length === 0) {
    return (
      <div
        className={cn(
          "h-10 flex items-center px-3",
          "bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]",
          "text-[var(--text-muted)] text-sm"
        )}
      >
        No open tabs
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-10 flex items-stretch",
        "bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]",
        "relative"
      )}
    >
      {/* Scroll left button */}
      {canScrollLeft && (
        <button
          onClick={() => handleScroll("left")}
          className={cn(
            "absolute left-0 top-0 bottom-0 z-10 px-1",
            "bg-gradient-to-r from-[var(--bg-tertiary)] to-transparent",
            "hover:from-[var(--bg-secondary)]",
            "transition-colors duration-150"
          )}
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch overflow-x-auto scrollbar-none relative"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            onMouseDown={(e) => handleMouseDown(e, index)}
            style={getTabTransform(index)}
            className={cn(
              dragIndex === index && "opacity-30 pointer-events-none"
            )}
          >
            <TabItem
              tab={tab}
              isActive={tab.id === activeTabId}
              isRenaming={renamingTabId === tab.id}
              renameValue={renameValue}
              onActivate={() => setActiveTab(tab.id)}
              onClose={(e) => handleClose(e, tab.id)}
              onRenameStart={() => handleRenameStart(tab)}
              onRenameChange={setRenameValue}
              onRenameSubmit={() => handleRenameSubmit(tab.id)}
              onRenameCancel={handleRenameCancel}
              onCloseOthers={() => closeOtherTabs(tab.id)}
              onCloseAll={closeAllTabs}
              tabCount={tabs.length}
            />
          </div>
        ))}
      </div>

      {/* Scroll right button */}
      {canScrollRight && (
        <button
          onClick={() => handleScroll("right")}
          className={cn(
            "absolute right-0 top-0 bottom-0 z-10 px-1",
            "bg-gradient-to-l from-[var(--bg-tertiary)] to-transparent",
            "hover:from-[var(--bg-secondary)]",
            "transition-colors duration-150"
          )}
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* Floating ghost while dragging */}
      {dragIndex !== null && ghostStyle && (
        <div
          className={cn(
            "z-50 pointer-events-none",
            "rounded-md shadow-xl shadow-black/50 overflow-hidden",
            "opacity-85"
          )}
          style={ghostStyle}
        >
          <TabItem
            tab={tabs[dragIndex]}
            isActive={true}
            isRenaming={false}
            renameValue=""
            onActivate={() => {}}
            onClose={() => {}}
            onRenameStart={() => {}}
            onRenameChange={() => {}}
            onRenameSubmit={() => {}}
            onRenameCancel={() => {}}
            onCloseOthers={() => {}}
            onCloseAll={() => {}}
            tabCount={0}
          />
        </div>
      )}
    </div>
  );
}
