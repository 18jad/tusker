import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Loader2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useForeignKeyValues } from "../../hooks/useDatabase";
import type { ForeignKeyInfo } from "../../types";

interface RelationSelectProps {
  value: string;
  onChange: (value: string) => void;
  foreignKeyInfo: ForeignKeyInfo;
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
  isModified?: boolean;
  className?: string;
}

export function RelationSelect({
  value,
  onChange,
  foreignKeyInfo,
  disabled = false,
  placeholder = "Select...",
  hasError = false,
  isModified = false,
  className,
}: RelationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: options, isLoading } = useForeignKeyValues(
    foreignKeyInfo.referencedSchema,
    foreignKeyInfo.referencedTable,
    foreignKeyInfo.referencedColumn,
    search,
    100
  );

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

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: unknown) => {
    const strValue = selectedValue === null ? "" : String(selectedValue);
    onChange(strValue);
    setIsOpen(false);
    setSearch("");
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
          {hasValue && !disabled && (
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
          {/* Search input */}
          <div className="p-2 border-b border-[var(--border-color)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className={cn(
                  "w-full pl-7 pr-3 py-1.5 text-sm rounded",
                  "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
                  "border border-[var(--border-color)] outline-none",
                  "focus:border-[var(--accent)]",
                  "placeholder:text-[var(--text-muted)]"
                )}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-[var(--text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : options && options.length > 0 ? (
              <>
                {/* NULL option */}
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
                {options.map((option, index) => {
                  const optionStr = String(option);
                  const isSelected = optionStr === value;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "w-full px-3 py-2 text-sm text-left font-mono",
                        "hover:bg-[var(--bg-tertiary)] transition-colors",
                        isSelected && "bg-[var(--accent)]/10 text-[var(--accent)]"
                      )}
                    >
                      {optionStr}
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="py-4 text-center text-sm text-[var(--text-muted)]">
                No results found
              </div>
            )}
          </div>

          {/* Reference info */}
          <div className="px-3 py-1.5 border-t border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
            References: {foreignKeyInfo.referencedSchema}.{foreignKeyInfo.referencedTable}.{foreignKeyInfo.referencedColumn}
          </div>
        </div>
      )}
    </div>
  );
}
