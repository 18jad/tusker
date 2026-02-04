import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface EnumSelectProps {
  value: string;
  onChange: (value: string) => void;
  enumValues: string[];
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
  isModified?: boolean;
  className?: string;
  isNullable?: boolean;
}

export function EnumSelect({
  value,
  onChange,
  enumValues,
  disabled = false,
  placeholder = "Select...",
  hasError = false,
  isModified = false,
  className,
  isNullable = true,
}: EnumSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: string | null) => {
    const strValue = selectedValue === null ? "" : selectedValue;
    onChange(strValue);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const displayValue = value || placeholder;
  const hasValue = value !== "" && value !== null && value !== undefined;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-left",
          "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
          "border outline-none transition-colors",
          hasError
            ? "border-red-500"
            : isModified
              ? "border-[var(--warning)]"
              : "border-[var(--border-color)]",
          !disabled && "hover:border-[var(--accent)] focus:border-[var(--accent)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className={cn(!hasValue && "text-[var(--text-muted)]")}>
          {displayValue}
        </span>
        <div className="flex items-center gap-1">
          {hasValue && !disabled && isNullable && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-[var(--text-muted)] transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-full mt-1 rounded-md overflow-hidden",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "shadow-lg"
          )}
        >
          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {/* NULL option */}
            {isNullable && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left",
                  "hover:bg-[var(--bg-tertiary)] transition-colors",
                  "text-[var(--text-muted)] italic"
                )}
              >
                NULL
              </button>
            )}
            {enumValues.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left",
                    "hover:bg-[var(--bg-tertiary)] transition-colors",
                    isSelected && "bg-[var(--accent)]/10 text-[var(--accent)]"
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
