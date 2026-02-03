import { useState, useEffect, useMemo } from "react";
import { X, Save, Clock, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { TypedInput } from "../ui/TypedInput";
import type { Column, Row, CellValue } from "../../types";

interface RowDetailModalProps {
  row: Row;
  rowIndex: number;
  columns: Column[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Row) => void;      // Direct save (instant commit)
  onStage: (data: Row) => void;     // Add to staged changes
  onDelete: () => void;             // Delete row
  readOnly?: boolean;
  isDeleted?: boolean;
}

/**
 * Format cell value for display/editing
 */
function formatValue(value: CellValue): string {
  if (value === null) return "";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Parse string value back to appropriate type
 */
function parseValue(value: string, dataType: string): CellValue {
  if (value === "" || value.toLowerCase() === "null") return null;

  const type = dataType.toLowerCase();
  if (type.includes("int")) {
    const num = parseInt(value, 10);
    return isNaN(num) ? value : num;
  }
  if (type.includes("float") || type.includes("double") || type.includes("numeric") || type.includes("decimal")) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  if (type.includes("bool")) {
    return value.toLowerCase() === "true";
  }
  if (type.includes("json")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function RowDetailModal({
  row,
  rowIndex,
  columns,
  isOpen,
  onClose,
  onSave,
  onStage,
  onDelete,
  readOnly = false,
  isDeleted = false,
}: RowDetailModalProps) {
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize edited values when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      columns.forEach((col) => {
        initial[col.name] = formatValue(row[col.name]);
      });
      setEditedValues(initial);
      setShowDeleteConfirm(false);
      setValidationErrors({});
    }
  }, [isOpen, row, columns]);

  // Validate required fields - returns errors object
  const validateFields = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    columns.forEach((col) => {
      // Skip nullable fields - they can be empty
      if (col.isNullable) return;

      const value = editedValues[col.name] ?? "";
      const trimmed = value.trim();

      // Empty or "null" string means null value
      if (trimmed === "" || trimmed.toLowerCase() === "null") {
        errors[col.name] = "This field is required";
      }
    });
    return errors;
  };

  // Check if any values have changed
  const hasChanges = useMemo(() => {
    return columns.some((col) => {
      const original = formatValue(row[col.name]);
      const edited = editedValues[col.name] ?? "";
      return original !== edited;
    });
  }, [columns, row, editedValues]);

  // Build the updated row data
  const getUpdatedRow = (): Row => {
    const updated: Row = {};
    columns.forEach((col) => {
      const editedValue = editedValues[col.name] ?? "";
      updated[col.name] = parseValue(editedValue, col.dataType);
    });
    return updated;
  };

  const handleSave = () => {
    const errors = validateFields();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (hasChanges) {
      onSave(getUpdatedRow());
    }
    onClose();
  };

  const handleStage = () => {
    const errors = validateFields();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (hasChanges) {
      onStage(getUpdatedRow());
    }
    onClose();
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete();
      onClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleFieldChange = (columnName: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [columnName]: value,
    }));
    // Clear validation error when user modifies the field
    if (validationErrors[columnName]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[columnName];
        return next;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          "w-[700px] max-w-[90vw] max-h-[85vh] flex flex-col",
          "bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Row #{rowIndex + 1}
            </span>
            {isDeleted && (
              <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                Marked for deletion
              </span>
            )}
            {hasChanges && !isDeleted && (
              <span className="px-2 py-0.5 text-xs rounded bg-[var(--warning)]/20 text-[var(--warning)]">
                Modified
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="space-y-4">
            {columns.map((column) => {
              const value = editedValues[column.name] ?? "";
              const originalValue = formatValue(row[column.name]);
              const isModified = value !== originalValue;
              const hasError = !!validationErrors[column.name];
              const isRequired = !column.isNullable;

              return (
                <div key={column.name} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-[var(--text-primary)]">
                      {column.name}
                    </label>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {column.dataType}
                    </span>
                    {column.isPrimaryKey && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--warning)]/20 text-[var(--warning)]">
                        PK
                      </span>
                    )}
                    {isRequired && (
                      <span className="text-[10px] text-red-400">*</span>
                    )}
                    {isModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" title="Modified" />
                    )}
                  </div>
                  <TypedInput
                    value={value}
                    onChange={(newValue) => handleFieldChange(column.name, newValue)}
                    dataType={column.dataType}
                    disabled={readOnly || isDeleted}
                    placeholder={column.isNullable ? "NULL" : "Required"}
                    hasError={hasError}
                    isModified={isModified}
                  />
                  {hasError && (
                    <p className="text-xs text-red-400">{validationErrors[column.name]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] shrink-0">
          <div>
            {!readOnly && !isDeleted && (
              <button
                onClick={handleDelete}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  showDeleteConfirm
                    ? "bg-red-500 text-white"
                    : "text-red-400 hover:bg-red-500/10"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {showDeleteConfirm ? "Click to confirm" : "Delete"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--bg-tertiary)] transition-colors"
              )}
            >
              Cancel
            </button>
            {!readOnly && !isDeleted && (
              <>
                <button
                  onClick={handleStage}
                  disabled={!hasChanges}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md",
                    "text-[var(--text-secondary)] border border-[var(--border-color)]",
                    "hover:bg-[var(--bg-tertiary)] transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Stage
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md",
                    "bg-[var(--accent)] text-white",
                    "hover:opacity-90 transition-opacity",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
