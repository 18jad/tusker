import { useState, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Key,
  Table,
  Code,
  AlertCircle,
  Loader2,
  GripVertical,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useExecuteSQL } from "../../hooks/useDatabase";
import { generateCreateTableSQL, type ColumnDefinition } from "../../lib/sql";
import { cn } from "../../lib/utils";

// Common PostgreSQL data types organized by category
const POSTGRES_TYPES = {
  "Numeric": [
    { value: "INTEGER", label: "INTEGER", description: "Signed 4-byte integer" },
    { value: "BIGINT", label: "BIGINT", description: "Signed 8-byte integer" },
    { value: "SMALLINT", label: "SMALLINT", description: "Signed 2-byte integer" },
    { value: "SERIAL", label: "SERIAL", description: "Auto-incrementing 4-byte integer" },
    { value: "BIGSERIAL", label: "BIGSERIAL", description: "Auto-incrementing 8-byte integer" },
    { value: "NUMERIC", label: "NUMERIC", description: "Exact numeric with precision" },
    { value: "DECIMAL", label: "DECIMAL", description: "Exact numeric (alias for NUMERIC)" },
    { value: "REAL", label: "REAL", description: "Single precision floating-point (4 bytes)" },
    { value: "DOUBLE PRECISION", label: "DOUBLE PRECISION", description: "Double precision floating-point (8 bytes)" },
    { value: "MONEY", label: "MONEY", description: "Currency amount" },
  ],
  "Text": [
    { value: "TEXT", label: "TEXT", description: "Variable unlimited length" },
    { value: "VARCHAR(255)", label: "VARCHAR(255)", description: "Variable length with limit" },
    { value: "VARCHAR(50)", label: "VARCHAR(50)", description: "Variable length (short)" },
    { value: "CHAR(1)", label: "CHAR(1)", description: "Fixed length character" },
    { value: "CHAR(10)", label: "CHAR(10)", description: "Fixed length (10 chars)" },
  ],
  "Date/Time": [
    { value: "TIMESTAMP", label: "TIMESTAMP", description: "Date and time (no timezone)" },
    { value: "TIMESTAMPTZ", label: "TIMESTAMPTZ", description: "Date and time with timezone" },
    { value: "DATE", label: "DATE", description: "Date only (no time)" },
    { value: "TIME", label: "TIME", description: "Time only (no date)" },
    { value: "TIMETZ", label: "TIMETZ", description: "Time with timezone" },
    { value: "INTERVAL", label: "INTERVAL", description: "Time interval" },
  ],
  "Boolean": [
    { value: "BOOLEAN", label: "BOOLEAN", description: "True/false value" },
  ],
  "UUID": [
    { value: "UUID", label: "UUID", description: "Universally unique identifier" },
  ],
  "JSON": [
    { value: "JSON", label: "JSON", description: "JSON data (text storage)" },
    { value: "JSONB", label: "JSONB", description: "JSON data (binary, indexed)" },
  ],
  "Binary": [
    { value: "BYTEA", label: "BYTEA", description: "Binary data" },
  ],
  "Network": [
    { value: "INET", label: "INET", description: "IPv4 or IPv6 host address" },
    { value: "CIDR", label: "CIDR", description: "IPv4 or IPv6 network address" },
    { value: "MACADDR", label: "MACADDR", description: "MAC address" },
  ],
  "Arrays": [
    { value: "TEXT[]", label: "TEXT[]", description: "Array of text" },
    { value: "INTEGER[]", label: "INTEGER[]", description: "Array of integers" },
    { value: "VARCHAR[]", label: "VARCHAR[]", description: "Array of varchar" },
  ],
};

interface ColumnFormState {
  id: string;
  name: string;
  dataType: string;
  customType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string;
  isExpanded: boolean;
}

const createEmptyColumn = (): ColumnFormState => ({
  id: Math.random().toString(36).substring(2, 11),
  name: "",
  dataType: "TEXT",
  customType: "",
  isNullable: true,
  isPrimaryKey: false,
  isUnique: false,
  defaultValue: "",
  isExpanded: true,
});

export function CreateTableModal() {
  const { createTableModalOpen, createTableSchema, closeCreateTableModal } = useUIStore();
  const { schemas } = useProjectStore();
  const executeSQL = useExecuteSQL();

  const [tableName, setTableName] = useState("");
  const [selectedSchema, setSelectedSchema] = useState("");
  const [columns, setColumns] = useState<ColumnFormState[]>([createEmptyColumn()]);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize schema when modal opens
  useEffect(() => {
    if (createTableModalOpen) {
      setTableName("");
      setError(null);
      setShowPreview(false);

      // Set initial schema
      if (createTableSchema) {
        setSelectedSchema(createTableSchema);
      } else if (schemas.length > 0) {
        setSelectedSchema(schemas[0].name);
      }

      // Reset columns to one empty column
      setColumns([createEmptyColumn()]);
    }
  }, [createTableModalOpen, createTableSchema, schemas]);

  const updateColumn = useCallback((id: string, updates: Partial<ColumnFormState>) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, ...updates } : col))
    );
    setError(null);
  }, []);

  const addColumn = useCallback(() => {
    // Collapse all existing columns and add new expanded one
    setColumns((prev) => [
      ...prev.map((col) => ({ ...col, isExpanded: false })),
      createEmptyColumn(),
    ]);
  }, []);

  const removeColumn = useCallback((id: string) => {
    setColumns((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one column
      return prev.filter((col) => col.id !== id);
    });
  }, []);

  const toggleColumnExpanded = useCallback((id: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, isExpanded: !col.isExpanded } : col))
    );
  }, []);

  const getColumnDefinitions = (): ColumnDefinition[] => {
    return columns.map((col) => ({
      name: col.name.trim(),
      dataType: col.dataType === "CUSTOM" ? col.customType.trim() : col.dataType,
      isNullable: col.isNullable,
      isPrimaryKey: col.isPrimaryKey,
      isUnique: col.isUnique,
      defaultValue: col.defaultValue.trim(),
    }));
  };

  const generateSQL = (): string | null => {
    try {
      const columnDefs = getColumnDefinitions();
      return generateCreateTableSQL(selectedSchema, tableName.trim(), columnDefs);
    } catch (err) {
      return null;
    }
  };

  const handleCreate = async () => {
    setError(null);

    // Validation
    if (!tableName.trim()) {
      setError("Table name is required");
      return;
    }

    if (!selectedSchema) {
      setError("Please select a schema");
      return;
    }

    // Validate columns
    for (const col of columns) {
      if (!col.name.trim()) {
        setError("All columns must have a name");
        return;
      }
      if (col.dataType === "CUSTOM" && !col.customType.trim()) {
        setError(`Please specify a custom type for column "${col.name}"`);
        return;
      }
    }

    // Check for duplicate column names
    const names = columns.map((c) => c.name.trim().toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate column name: "${duplicates[0]}"`);
      return;
    }

    try {
      const sql = generateCreateTableSQL(selectedSchema, tableName.trim(), getColumnDefinitions());
      await executeSQL.mutateAsync({ sql });
      closeCreateTableModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create table");
    }
  };

  const previewSQL = generateSQL();

  if (!createTableModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && closeCreateTableModal()}
    >
      <div
        className={cn(
          "w-full max-w-2xl max-h-[90vh] flex flex-col",
          "bg-[var(--bg-primary)] border border-[var(--border-color)]",
          "rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Table className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Create New Table
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Define your table structure
              </p>
            </div>
          </div>
          <button
            onClick={closeCreateTableModal}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Table Name and Schema */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Schema
              </label>
              <select
                value={selectedSchema}
                onChange={(e) => setSelectedSchema(e.target.value)}
                className={cn(
                  "w-full h-9 px-3 rounded-lg text-sm",
                  "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
                  "border border-[var(--border-color)]",
                  "focus:border-[var(--accent)] focus:outline-none"
                )}
              >
                {schemas.map((schema) => (
                  <option key={schema.name} value={schema.name}>
                    {schema.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Table Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => {
                  setTableName(e.target.value);
                  setError(null);
                }}
                placeholder="users"
                className={cn(
                  "w-full h-9 px-3 rounded-lg text-sm",
                  "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
                  "border border-[var(--border-color)]",
                  "focus:border-[var(--accent)] focus:outline-none",
                  "placeholder:text-[var(--text-muted)]"
                )}
              />
            </div>
          </div>

          {/* Columns Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Columns
              </label>
              <span className="text-xs text-[var(--text-muted)]">
                {columns.length} column{columns.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-2">
              {columns.map((column, index) => (
                <ColumnEditor
                  key={column.id}
                  column={column}
                  index={index}
                  onUpdate={(updates) => updateColumn(column.id, updates)}
                  onRemove={() => removeColumn(column.id)}
                  onToggleExpanded={() => toggleColumnExpanded(column.id)}
                  canRemove={columns.length > 1}
                />
              ))}
            </div>

            <button
              onClick={addColumn}
              className={cn(
                "w-full mt-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg",
                "border border-dashed border-[var(--border-color)]",
                "text-sm text-[var(--text-muted)]",
                "hover:border-[var(--accent)] hover:text-[var(--accent)]",
                "transition-colors"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Column
            </button>
          </div>

          {/* SQL Preview */}
          <div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {showPreview ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <Code className="w-4 h-4" />
              Preview SQL
            </button>
            {showPreview && previewSQL && (
              <pre
                className={cn(
                  "mt-2 p-3 rounded-lg text-xs font-mono overflow-x-auto",
                  "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
                  "border border-[var(--border-color)]"
                )}
              >
                {previewSQL}
              </pre>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-color)] shrink-0">
          <button
            onClick={closeCreateTableModal}
            className={cn(
              "px-4 py-2 text-sm rounded-lg",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={executeSQL.isPending || !tableName.trim()}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-lg",
              "bg-purple-500 text-white",
              "hover:bg-purple-600 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {executeSQL.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Table
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Column Editor Component
function ColumnEditor({
  column,
  index,
  onUpdate,
  onRemove,
  onToggleExpanded,
  canRemove,
}: {
  column: ColumnFormState;
  index: number;
  onUpdate: (updates: Partial<ColumnFormState>) => void;
  onRemove: () => void;
  onToggleExpanded: () => void;
  canRemove: boolean;
}) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const getTypeLabel = () => {
    if (column.dataType === "CUSTOM") {
      return column.customType || "Custom...";
    }
    return column.dataType;
  };

  return (
    <div
      className={cn(
        "border border-[var(--border-color)] rounded-lg overflow-hidden",
        "bg-[var(--bg-secondary)]"
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer",
          "hover:bg-[var(--bg-tertiary)] transition-colors"
        )}
        onClick={onToggleExpanded}
      >
        <GripVertical className="w-4 h-4 text-[var(--text-muted)]" />
        {column.isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        )}

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {column.name || `Column ${index + 1}`}
          </span>
          <span className="text-xs text-[var(--text-muted)] truncate">
            {getTypeLabel()}
          </span>
          {column.isPrimaryKey && (
            <Key className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          )}
        </div>

        {canRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Column Details (Expanded) */}
      {column.isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[var(--border-color)]">
          {/* Name and Type Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={column.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="column_name"
                className={cn(
                  "w-full h-8 px-2.5 rounded text-sm",
                  "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                  "border border-[var(--border-color)]",
                  "focus:border-[var(--accent)] focus:outline-none",
                  "placeholder:text-[var(--text-muted)]"
                )}
              />
            </div>
            <div className="relative">
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Type <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className={cn(
                  "w-full h-8 px-2.5 rounded text-sm text-left",
                  "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                  "border border-[var(--border-color)]",
                  "hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none",
                  "flex items-center justify-between"
                )}
              >
                <span className="truncate">{getTypeLabel()}</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </button>

              {showTypeDropdown && (
                <TypeDropdown
                  value={column.dataType}
                  onSelect={(type) => {
                    onUpdate({ dataType: type });
                    setShowTypeDropdown(false);
                  }}
                  onClose={() => setShowTypeDropdown(false)}
                />
              )}
            </div>
          </div>

          {/* Custom Type Input */}
          {column.dataType === "CUSTOM" && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Custom Type <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={column.customType}
                onChange={(e) => onUpdate({ customType: e.target.value })}
                placeholder="e.g., VARCHAR(100), NUMERIC(10,2)"
                className={cn(
                  "w-full h-8 px-2.5 rounded text-sm font-mono",
                  "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                  "border border-[var(--border-color)]",
                  "focus:border-[var(--accent)] focus:outline-none",
                  "placeholder:text-[var(--text-muted)]"
                )}
              />
            </div>
          )}

          {/* Default Value */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Default Value
            </label>
            <input
              type="text"
              value={column.defaultValue}
              onChange={(e) => onUpdate({ defaultValue: e.target.value })}
              placeholder="e.g., 0, 'text', NOW(), uuid_generate_v4()"
              className={cn(
                "w-full h-8 px-2.5 rounded text-sm font-mono",
                "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                "border border-[var(--border-color)]",
                "focus:border-[var(--accent)] focus:outline-none",
                "placeholder:text-[var(--text-muted)]"
              )}
            />
          </div>

          {/* Constraints Row */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={column.isPrimaryKey}
                onChange={(e) => {
                  onUpdate({
                    isPrimaryKey: e.target.checked,
                    isNullable: e.target.checked ? false : column.isNullable,
                  });
                }}
                className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-secondary)]">Primary Key</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!column.isNullable}
                disabled={column.isPrimaryKey}
                onChange={(e) => onUpdate({ isNullable: !e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-[var(--accent)] disabled:opacity-50"
              />
              <span className={cn("text-xs", column.isPrimaryKey ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]")}>
                Not Null
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={column.isUnique}
                disabled={column.isPrimaryKey}
                onChange={(e) => onUpdate({ isUnique: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-[var(--accent)] disabled:opacity-50"
              />
              <span className={cn("text-xs", column.isPrimaryKey ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]")}>
                Unique
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// Type Dropdown Component
function TypeDropdown({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (type: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".type-dropdown")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      className={cn(
        "type-dropdown absolute z-50 mt-1 w-72 max-h-64 overflow-y-auto",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
        "rounded-lg shadow-xl"
      )}
    >
      {Object.entries(POSTGRES_TYPES).map(([category, types]) => (
        <div key={category}>
          <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] sticky top-0">
            {category}
          </div>
          {types.map((type) => (
            <button
              key={type.value}
              onClick={() => onSelect(type.value)}
              className={cn(
                "w-full px-3 py-1.5 text-left",
                "hover:bg-[var(--bg-tertiary)] transition-colors",
                value === type.value && "bg-[var(--accent)]/10"
              )}
            >
              <div className="text-sm text-[var(--text-primary)]">{type.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{type.description}</div>
            </button>
          ))}
        </div>
      ))}
      {/* Custom Type Option */}
      <div>
        <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] sticky top-0">
          Other
        </div>
        <button
          onClick={() => onSelect("CUSTOM")}
          className={cn(
            "w-full px-3 py-1.5 text-left",
            "hover:bg-[var(--bg-tertiary)] transition-colors",
            value === "CUSTOM" && "bg-[var(--accent)]/10"
          )}
        >
          <div className="text-sm text-[var(--text-primary)]">Custom Type</div>
          <div className="text-xs text-[var(--text-muted)]">Enter any PostgreSQL type</div>
        </button>
      </div>
    </div>
  );
}
