import { useRef, useState, useEffect, useCallback } from "react";
import { X, Table2, FileCode, ChevronLeft, ChevronRight, Database, FileUp } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
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
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function TabItem({ tab, isActive, onActivate, onClose }: TabItemProps) {
  const Icon = getTabIcon(tab.type);

  return (
    <div
      role="tab"
      tabIndex={0}
      onClick={onActivate}
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
      <span className="truncate text-sm select-none">{tab.title}</span>
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
  );
}

export function TabBar() {
  const tabs = useUIStore((state) => state.tabs);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const closeTab = useUIStore((state) => state.closeTab);
  const reorderTabs = useUIStore((state) => state.reorderTabs);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag state - use refs for values needed in event handlers (closure issue)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndicatorLeft, setDropIndicatorLeft] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);

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

    // Store in ref for access in mouseup handler
    dragIndexRef.current = index;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Start drag only after moving a few pixels (to allow clicks)
      if (!isDragging) {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (dx > 5 || dy > 5) {
          isDragging = true;
          setDragIndex(index);
        }
      }

      if (isDragging && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const mouseX = moveEvent.clientX - containerRect.left + container.scrollLeft;

        // Find drop position
        let newDropIndex = tabs.length;
        let indicatorLeft = 0;

        for (let i = 0; i < tabRefs.current.length; i++) {
          const tabEl = tabRefs.current[i];
          if (!tabEl) continue;

          const tabRect = tabEl.getBoundingClientRect();
          const tabLeft = tabRect.left - containerRect.left + container.scrollLeft;
          const tabCenter = tabLeft + tabRect.width / 2;

          if (mouseX < tabCenter) {
            newDropIndex = i;
            indicatorLeft = tabLeft;
            break;
          } else {
            indicatorLeft = tabLeft + tabRect.width;
          }
        }

        // Don't show indicator at the original position or right next to it
        if (newDropIndex === index || newDropIndex === index + 1) {
          dropIndexRef.current = null;
          setDropIndicatorLeft(null);
        } else {
          dropIndexRef.current = newDropIndex;
          setDropIndicatorLeft(indicatorLeft);
        }
      }
    };

    const handleMouseUp = () => {
      const fromIndex = dragIndexRef.current;
      const toIndex = dropIndexRef.current;

      if (isDragging && fromIndex !== null && toIndex !== null) {
        // Adjust drop index if dropping after the original position
        const adjustedDropIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
        if (adjustedDropIndex !== fromIndex) {
          reorderTabs(fromIndex, adjustedDropIndex);
        }
      }

      // Reset state
      dragIndexRef.current = null;
      dropIndexRef.current = null;
      setDragIndex(null);
      setDropIndicatorLeft(null);

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
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
            className={cn(
              dragIndex === index && "opacity-50"
            )}
          >
            <TabItem
              tab={tab}
              isActive={tab.id === activeTabId}
              onActivate={() => setActiveTab(tab.id)}
              onClose={(e) => handleClose(e, tab.id)}
            />
          </div>
        ))}

        {/* Drop indicator */}
        {dropIndicatorLeft !== null && (
          <div
            className="absolute top-1 bottom-1 w-0.5 bg-[var(--accent)] rounded-full z-20 pointer-events-none"
            style={{ left: dropIndicatorLeft }}
          />
        )}
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
    </div>
  );
}
