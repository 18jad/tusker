import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { RelationSelect } from "./RelationSelect";
import { EnumSelect } from "./EnumSelect";
import type { ForeignKeyInfo } from "../../types";
import "react-datepicker/dist/react-datepicker.css";

interface TypedInputProps {
  value: string;
  onChange: (value: string) => void;
  dataType: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  isModified?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  isForeignKey?: boolean;
  foreignKeyInfo?: ForeignKeyInfo;
  enumValues?: string[];
}

/**
 * Determines the input type based on PostgreSQL data type
 */
function getInputConfig(dataType: string): {
  type: "text" | "number" | "date" | "time" | "datetime" | "boolean" | "textarea";
  step?: string;
  inputMode?: "numeric" | "decimal" | "text";
} {
  const type = dataType.toLowerCase();

  // Boolean types
  if (type === "boolean" || type === "bool") {
    return { type: "boolean" };
  }

  // Integer types
  if (
    type.includes("int") ||
    type.includes("serial") ||
    type === "smallint" ||
    type === "bigint"
  ) {
    return { type: "number", step: "1", inputMode: "numeric" };
  }

  // Decimal/float types
  if (
    type.includes("float") ||
    type.includes("double") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type === "real" ||
    type === "money"
  ) {
    return { type: "number", step: "any", inputMode: "decimal" };
  }

  // Date type (no time)
  if (type === "date") {
    return { type: "date" };
  }

  // Time type (no date)
  if (type === "time" || type === "time without time zone") {
    return { type: "time" };
  }

  // Timestamp types (date + time)
  if (type.includes("timestamp") || type === "timestamptz") {
    return { type: "datetime" };
  }

  // JSON types - use textarea
  if (type.includes("json")) {
    return { type: "textarea" };
  }

  // Text/large text types - use textarea
  if (type === "text" || type.includes("[]")) {
    return { type: "textarea" };
  }

  // Default to text input
  return { type: "text" };
}

/**
 * Parse string value to Date object
 */
function parseDate(value: string): Date | null {
  if (!value || value === "null" || value === "NULL") return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format Date to ISO string for storage
 */
function formatDateForStorage(date: Date | null): string {
  if (!date) return "";
  return date.toISOString();
}

/**
 * Format Date to date-only string (YYYY-MM-DD)
 */
function formatDateOnly(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Format time string for storage (HH:mm:ss)
 */
function formatTimeForStorage(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Parse time string to Date object (today with that time)
 */
function parseTime(value: string): Date | null {
  if (!value || value === "null" || value === "NULL") return null;
  try {
    const [hours, minutes, seconds] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, seconds || 0, 0);
    return date;
  } catch {
    return null;
  }
}

const inputClasses = cn(
  "w-full px-3 py-2 text-sm rounded-md",
  "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
  "border border-[var(--border-color)] outline-none focus-visible:outline-none",
  "focus:border-[var(--accent)]",
  "disabled:opacity-50 disabled:cursor-not-allowed"
);

export function TypedInput({
  value,
  onChange,
  dataType,
  disabled = false,
  placeholder,
  className,
  hasError = false,
  isModified = false,
  autoFocus = false,
  onBlur,
  isForeignKey = false,
  foreignKeyInfo,
  enumValues,
}: TypedInputProps) {
  const config = getInputConfig(dataType);
  const [localValue, setLocalValue] = useState(value);

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const errorClasses = hasError && "border-red-500 focus:border-red-500";
  const modifiedClasses = isModified && !hasError && "border-[var(--warning)]";

  // Foreign key type - render as relation select
  if (isForeignKey && foreignKeyInfo) {
    return (
      <RelationSelect
        value={localValue}
        onChange={handleChange}
        foreignKeyInfo={foreignKeyInfo}
        disabled={disabled}
        placeholder={placeholder}
        hasError={hasError}
        isModified={isModified}
        className={className}
      />
    );
  }

  // Enum type - render as styled select dropdown
  if (enumValues && enumValues.length > 0) {
    return (
      <EnumSelect
        value={localValue}
        onChange={handleChange}
        enumValues={enumValues}
        disabled={disabled}
        placeholder={placeholder}
        hasError={hasError}
        isModified={isModified}
        className={className}
      />
    );
  }

  // Boolean type - render as select
  if (config.type === "boolean") {
    const boolValue = localValue === "" || localValue === "null" ? "" : localValue === "true" ? "true" : "false";
    return (
      <select
        value={boolValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        className={cn(inputClasses, errorClasses, modifiedClasses, className)}
      >
        <option value="">NULL</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // Textarea type
  if (config.type === "textarea") {
    return (
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        rows={4}
        className={cn(
          inputClasses,
          "font-mono resize-y",
          errorClasses,
          modifiedClasses,
          className
        )}
        placeholder={placeholder}
      />
    );
  }

  // Date input (date only, no time)
  if (config.type === "date") {
    const dateValue = parseDate(localValue);
    return (
      <DatePicker
        selected={dateValue}
        onChange={(date: Date | null) => handleChange(formatDateOnly(date))}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        dateFormat="yyyy-MM-dd"
        placeholderText={placeholder || "Select date"}
        className={cn(inputClasses, errorClasses, modifiedClasses, className)}
        calendarClassName="dark-datepicker"
        wrapperClassName="w-full"
        showPopperArrow={false}
        isClearable
      />
    );
  }

  // Time input
  if (config.type === "time") {
    const timeValue = parseTime(localValue);
    return (
      <DatePicker
        selected={timeValue}
        onChange={(date: Date | null) => handleChange(formatTimeForStorage(date))}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={1}
        timeCaption="Time"
        dateFormat="HH:mm:ss"
        placeholderText={placeholder || "Select time"}
        className={cn(inputClasses, errorClasses, modifiedClasses, className)}
        calendarClassName="dark-datepicker"
        wrapperClassName="w-full"
        showPopperArrow={false}
        isClearable
      />
    );
  }

  // Datetime input (date + time)
  if (config.type === "datetime") {
    const dateValue = parseDate(localValue);
    return (
      <DatePicker
        selected={dateValue}
        onChange={(date: Date | null) => handleChange(formatDateForStorage(date))}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        showTimeSelect
        timeIntervals={1}
        timeCaption="Time"
        dateFormat="yyyy-MM-dd HH:mm:ss"
        placeholderText={placeholder || "Select date and time"}
        className={cn(inputClasses, errorClasses, modifiedClasses, className)}
        calendarClassName="dark-datepicker"
        wrapperClassName="w-full"
        showPopperArrow={false}
        isClearable
      />
    );
  }

  // Number input with custom increment/decrement buttons
  if (config.type === "number") {
    const isInteger = config.step === "1";
    const step = isInteger ? 1 : 0.1;

    const increment = () => {
      const current = parseFloat(localValue) || 0;
      const newValue = isInteger
        ? Math.round(current + step).toString()
        : (current + step).toFixed(2).replace(/\.?0+$/, "");
      handleChange(newValue);
    };

    const decrement = () => {
      const current = parseFloat(localValue) || 0;
      const newValue = isInteger
        ? Math.round(current - step).toString()
        : (current - step).toFixed(2).replace(/\.?0+$/, "");
      handleChange(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        increment();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        decrement();
      }
    };

    return (
      <div
        className={cn(
          "flex w-full rounded-md overflow-hidden",
          "border bg-[var(--bg-secondary)]",
          hasError
            ? "border-red-500 focus-within:border-red-500"
            : isModified
              ? "border-[var(--warning)] focus-within:border-[var(--warning)]"
              : "border-[var(--border-color)] focus-within:border-[var(--accent)]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input
          type="text"
          inputMode={config.inputMode}
          value={localValue}
          onChange={(e) => {
            const val = e.target.value;
            // Allow empty, minus sign, or valid number patterns
            if (val === "" || val === "-") {
              handleChange(val);
            } else if (isInteger) {
              // Integer: only digits and optional leading minus
              if (/^-?\d*$/.test(val)) {
                handleChange(val);
              }
            } else {
              // Decimal: digits, optional minus, optional decimal point
              if (/^-?\d*\.?\d*$/.test(val)) {
                handleChange(val);
              }
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          onBlur={onBlur}
          className={cn(
            "flex-1 px-3 py-2 text-sm bg-transparent text-[var(--text-primary)]",
            "outline-none border-none",
            "disabled:cursor-not-allowed"
          )}
          placeholder={placeholder}
        />
        <div className="flex flex-col border-l border-[var(--border-color)]">
          <button
            type="button"
            onClick={increment}
            disabled={disabled}
            className={cn(
              "flex-1 px-2 flex items-center justify-center",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            tabIndex={-1}
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={decrement}
            disabled={disabled}
            className={cn(
              "flex-1 px-2 flex items-center justify-center",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "border-t border-[var(--border-color)]"
            )}
            tabIndex={-1}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled}
      autoFocus={autoFocus}
      onBlur={onBlur}
      className={cn(inputClasses, errorClasses, modifiedClasses, className)}
      placeholder={placeholder}
    />
  );
}
