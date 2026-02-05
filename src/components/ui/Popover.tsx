import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface PopoverItemBase {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface PopoverSeparator {
  type: "separator";
}

type PopoverItem = PopoverItemBase | PopoverSeparator;

interface PopoverProps {
  items: PopoverItem[];
  trigger: React.ReactNode;
  align?: "start" | "end";
  disabled?: boolean;
}

export function Popover({ items, trigger, align = "end", disabled }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
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

  const handleItemClick = (item: PopoverItemBase) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  const isSeparator = (item: PopoverItem): item is PopoverSeparator => {
    return "type" in item && item.type === "separator";
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(disabled && "opacity-50 cursor-not-allowed")}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-[100] min-w-[160px] mt-1",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "rounded-lg shadow-xl shadow-black/30",
            "py-1",
            "animate-in fade-in zoom-in-95 duration-100",
            align === "end" ? "right-0" : "left-0"
          )}
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
        </div>
      )}
    </div>
  );
}
