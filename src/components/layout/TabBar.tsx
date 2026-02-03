import { useRef, useState, useEffect, useCallback } from "react";
import { X, Table2, FileCode, ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { cn } from "../../lib/utils";
import type { Tab } from "../../types";

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function TabItem({ tab, isActive, onActivate, onClose }: TabItemProps) {
  const Icon = tab.type === "table" ? Table2 : FileCode;

  return (
    <div
      role="tab"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => e.key === "Enter" && onActivate()}
      className={cn(
        "group flex items-center gap-2 px-3 h-10 min-w-[120px] max-w-[200px]",
        "border-r border-[var(--border-color)]",
        "transition-colors duration-150 shrink-0 cursor-pointer",
        isActive
          ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
          : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
      <span className="truncate text-sm">{tab.title}</span>
      <button
        onClick={onClose}
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
        className="flex items-stretch overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => setActiveTab(tab.id)}
            onClose={(e) => handleClose(e, tab.id)}
          />
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
    </div>
  );
}
