import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuItemBase {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface ContextMenuSubmenu {
  type: "submenu";
  label: string;
  icon?: React.ReactNode;
  items: ContextMenuItemBase[];
}

interface ContextMenuSeparator {
  type: "separator";
}

type ContextMenuItem = ContextMenuItemBase | ContextMenuSeparator | ContextMenuSubmenu;

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

interface SubmenuItemProps {
  item: ContextMenuSubmenu;
  onItemClick: (item: ContextMenuItemBase) => void;
}

function SubmenuItem({ item, onItemClick }: SubmenuItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  // Calculate submenu position
  const getSubmenuStyle = (): React.CSSProperties => {
    if (!itemRef.current) return { left: "100%", top: 0 };

    const rect = itemRef.current.getBoundingClientRect();
    const submenuWidth = 160;
    const viewportWidth = window.innerWidth;

    // Check if submenu would overflow right side
    if (rect.right + submenuWidth > viewportWidth) {
      return { right: "100%", top: 0 };
    }

    return { left: "100%", top: 0 };
  };

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-default",
          "transition-colors duration-100",
          "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        )}
      >
        {item.icon && (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {item.icon}
          </span>
        )}
        <span className="flex-1">{item.label}</span>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </div>

      {isOpen && (
        <div
          ref={submenuRef}
          className={cn(
            "absolute z-[101] min-w-[160px]",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "rounded-lg shadow-xl shadow-black/30",
            "py-1",
            "animate-in fade-in zoom-in-95 duration-100"
          )}
          style={getSubmenuStyle()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {item.items.map((subItem, index) => (
            <button
              key={index}
              onClick={() => onItemClick(subItem)}
              disabled={subItem.disabled}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
                "transition-colors duration-100",
                subItem.variant === "danger"
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
                subItem.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {subItem.icon && (
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {subItem.icon}
                </span>
              )}
              <span>{subItem.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContextMenu({ items, children, disabled, className }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;

    e.preventDefault();
    e.stopPropagation();

    // Calculate position, ensuring menu stays within viewport
    const x = e.clientX;
    const y = e.clientY;

    setPosition({ x, y });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }

      if (position.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      if (adjustedX !== position.x || adjustedY !== position.y) {
        setPosition({ x: adjustedX, y: adjustedY });
      }
    }
  }, [isOpen, position]);

  const handleItemClick = (item: ContextMenuItemBase) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  const isSeparator = (item: ContextMenuItem): item is ContextMenuSeparator => {
    return "type" in item && item.type === "separator";
  };

  const isSubmenu = (item: ContextMenuItem): item is ContextMenuSubmenu => {
    return "type" in item && item.type === "submenu";
  };

  return (
    <>
      <div ref={containerRef} onContextMenu={handleContextMenu} data-context-menu className={className}>
        {children}
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className={cn(
            "fixed z-[100] min-w-[160px]",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "rounded-lg shadow-xl shadow-black/30",
            "py-1",
            "animate-in fade-in zoom-in-95 duration-150"
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {items.map((item, index) => {
            if (isSeparator(item)) {
              return (
                <div
                  key={index}
                  className="my-1 border-t border-[var(--border-color)]"
                />
              );
            }

            if (isSubmenu(item)) {
              return (
                <SubmenuItem
                  key={index}
                  item={item}
                  onItemClick={(subItem) => {
                    subItem.onClick();
                    setIsOpen(false);
                  }}
                />
              );
            }

            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
                  "transition-colors duration-100",
                  item.variant === "danger"
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
