import { cn } from "../../lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: ToggleProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full items-center",
          "transition-colors duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
          checked ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)] border border-[var(--border-color)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute h-3.5 w-3.5 rounded-full",
            "bg-white shadow-sm",
            "transition-all duration-200 ease-out",
            checked ? "left-[18px]" : "left-[3px]"
          )}
        />
      </button>
      {label && (
        <span
          className={cn(
            "text-sm text-[var(--text-secondary)]",
            disabled && "opacity-50"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
