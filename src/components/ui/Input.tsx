import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, type = "text", disabled, className, id, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium text-[var(--text-secondary)]",
            disabled && "opacity-50"
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && showPassword ? "text" : type}
          disabled={disabled}
          className={cn(
            "w-full h-9 px-3 rounded-[4px] text-sm font-mono",
            "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
            "border border-[var(--border-color)]",
            "placeholder:text-[var(--text-muted)]",
            "transition-colors duration-150 ease-out",
            "hover:border-[#3a3a3a]",
            "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            disabled && "opacity-50 cursor-not-allowed",
            isPassword && "pr-10",
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded",
              "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              "transition-colors duration-150",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
});
