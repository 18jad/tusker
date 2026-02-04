import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: CheckboxProps) {
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
    <label
      className={cn(
        "flex items-center gap-2 cursor-pointer select-none",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex h-4 w-4 shrink-0 items-center justify-center rounded",
          "border transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-primary)]",
          checked
            ? "bg-[var(--accent)] border-[var(--accent)]"
            : "bg-transparent border-[var(--border-color)] hover:border-[var(--text-muted)]",
          disabled && "cursor-not-allowed"
        )}
      >
        <Check
          className={cn(
            "h-3 w-3 text-white transition-all duration-150",
            checked ? "opacity-100 scale-100" : "opacity-0 scale-75"
          )}
          strokeWidth={3}
        />
      </button>
      {label && (
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      )}
    </label>
  );
}
