import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
}

export function Tooltip({
  children,
  content,
  shortcut,
  side = "bottom",
  delayMs = 400,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        let top = 0;
        let left = 0;

        switch (side) {
          case "top":
            top = rect.top + scrollY - 8;
            left = rect.left + scrollX + rect.width / 2;
            break;
          case "bottom":
            top = rect.bottom + scrollY + 8;
            left = rect.left + scrollX + rect.width / 2;
            break;
          case "left":
            top = rect.top + scrollY + rect.height / 2;
            left = rect.left + scrollX - 8;
            break;
          case "right":
            top = rect.top + scrollY + rect.height / 2;
            left = rect.right + scrollX + 8;
            break;
        }

        setPosition({ top, left });
        setIsVisible(true);
      }
    }, delayMs);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-flex"
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            className={cn(
              "fixed z-[200] px-2.5 py-1.5 rounded-md",
              "bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "shadow-lg shadow-black/20",
              "text-xs text-[var(--text-primary)]",
              "pointer-events-none",
              "animate-in fade-in-0 zoom-in-95 duration-100",
              side === "top" && "-translate-x-1/2 -translate-y-full",
              side === "bottom" && "-translate-x-1/2",
              side === "left" && "-translate-x-full -translate-y-1/2",
              side === "right" && "-translate-y-1/2"
            )}
            style={{ top: position.top, left: position.left }}
          >
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut && (
                <span className="text-[var(--text-muted)] font-mono text-[10px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                  {shortcut}
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
