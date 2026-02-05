import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Table,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore } from "../../stores/uiStore";
import { getCurrentConnectionId } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import type { Tab, Column, Row, CellValue } from "../../types";

interface ImportDataTabProps {
  tab: Tab;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: "missing_column" | "parse_error";
  message: string;
  column?: string;
}

interface ValidationWarning {
  type: "extra_column_ignored";
  message: string;
  column?: string;
}

interface ColumnMatch {
  importColumn: string;
  tableColumn: Column | null;
  status: "matched" | "missing" | "extra";
}

export function ImportDataTab({ tab }: ImportDataTabProps) {
  const { closeTab, showToast } = useUIStore();
  const format = tab.importFormat || "csv";
  const schema = tab.schema || "";
  const table = tab.table || "";

  // State
  const [tableColumns, setTableColumns] = useState<Column[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(true);
  const [columnsError, setColumnsError] = useState<string | null>(null);

  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawData, setRawData] = useState<Row[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Fetch table columns on mount
  useEffect(() => {
    const fetchColumns = async () => {
      setIsLoadingColumns(true);
      setColumnsError(null);

      try {
        const connectionId = getCurrentConnectionId();
        if (!connectionId) throw new Error("Not connected to database");

        const cols = await invoke<{
          name: string;
          data_type: string;
          is_nullable: boolean;
          is_primary_key: boolean;
          is_foreign_key: boolean;
          default_value: string | null;
        }[]>("get_columns", {
          connectionId,
          schema,
          table,
        });

        setTableColumns(
          cols.map((c) => ({
            name: c.name,
            dataType: c.data_type,
            isNullable: c.is_nullable,
            isPrimaryKey: c.is_primary_key,
            isForeignKey: c.is_foreign_key,
            defaultValue: c.default_value ?? undefined,
          }))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setColumnsError(message);
      } finally {
        setIsLoadingColumns(false);
      }
    };

    fetchColumns();
  }, [schema, table]);

  // Parse CSV string - handles multi-line quoted values using RFC 4180 spec
  const parseCSV = useCallback((content: string): { columns: string[]; rows: Row[] } => {
    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentField = "";
    let inQuotedField = false;
    let i = 0;

    while (i < content.length) {
      const char = content[i];

      if (inQuotedField) {
        // Inside a quoted field
        if (char === '"') {
          // Check if this is an escaped quote (two quotes in a row)
          if (content[i + 1] === '"') {
            currentField += '"';
            i += 2;
            continue;
          } else {
            // End of quoted field
            inQuotedField = false;
            i++;
            continue;
          }
        } else {
          // Any character (including newlines) inside quotes is part of the field
          currentField += char;
          i++;
          continue;
        }
      }

      // Not inside a quoted field
      if (char === '"') {
        // Start of a quoted field (should be at field start)
        inQuotedField = true;
        i++;
        continue;
      }

      if (char === ',') {
        // End of field
        currentRecord.push(currentField);
        currentField = "";
        i++;
        continue;
      }

      if (char === '\r') {
        // Handle CRLF or just CR
        if (content[i + 1] === '\n') {
          // CRLF - end of record
          currentRecord.push(currentField);
          currentField = "";
          if (currentRecord.length > 0) {
            records.push(currentRecord);
          }
          currentRecord = [];
          i += 2;
          continue;
        }
        // Just CR (old Mac style) - treat as newline
        currentRecord.push(currentField);
        currentField = "";
        if (currentRecord.length > 0) {
          records.push(currentRecord);
        }
        currentRecord = [];
        i++;
        continue;
      }

      if (char === '\n') {
        // LF - end of record
        currentRecord.push(currentField);
        currentField = "";
        if (currentRecord.length > 0) {
          records.push(currentRecord);
        }
        currentRecord = [];
        i++;
        continue;
      }

      // Regular character
      currentField += char;
      i++;
    }

    // Handle the last field and record
    if (currentField !== "" || currentRecord.length > 0) {
      currentRecord.push(currentField);
    }
    if (currentRecord.length > 0) {
      records.push(currentRecord);
    }

    // Validate: filter out completely empty records
    const validRecords = records.filter(
      (r) => r.length > 1 || (r.length === 1 && r[0] !== "")
    );

    if (validRecords.length === 0) {
      return { columns: [], rows: [] };
    }

    // First record is headers
    const headers = validRecords[0].map((h) => h.trim());
    const expectedFieldCount = headers.length;

    // Parse data rows
    const rows: Row[] = [];
    for (let rowIdx = 1; rowIdx < validRecords.length; rowIdx++) {
      const values = validRecords[rowIdx];

      // Validate field count
      if (values.length !== expectedFieldCount) {
        console.warn(
          `CSV row ${rowIdx} has ${values.length} fields, expected ${expectedFieldCount}. Skipping.`
        );
        continue;
      }

      const row: Row = {};
      headers.forEach((header, idx) => {
        const value = values[idx];
        // Keep empty strings as null for database compatibility
        row[header] = value === "" ? null : value;
      });
      rows.push(row);
    }

    return { columns: headers, rows };
  }, []);

  // Parse JSON content
  const parseJSON = useCallback((content: string): { columns: string[]; rows: Row[] } => {
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error("JSON must be an array of objects");
    }

    if (data.length === 0) {
      return { columns: [], rows: [] };
    }

    // Get all unique keys from all objects
    const columnsSet = new Set<string>();
    data.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        Object.keys(item).forEach((key) => columnsSet.add(key));
      }
    });

    const columns = Array.from(columnsSet);
    const rows: Row[] = data.map((item) => {
      const row: Row = {};
      columns.forEach((col) => {
        row[col] = item[col] ?? null;
      });
      return row;
    });

    return { columns, rows };
  }, []);

  // Handle file selection
  const handleSelectFile = async () => {
    try {
      setFileError(null);

      const selected = await open({
        multiple: false,
        filters: format === "csv"
          ? [{ name: "CSV", extensions: ["csv"] }]
          : [{ name: "JSON", extensions: ["json"] }],
      });

      if (!selected) return;

      setIsLoadingFile(true);
      setFilePath(selected);
      setFileName(selected.split("/").pop() || selected);

      const content = await readTextFile(selected);

      const parsed = format === "csv" ? parseCSV(content) : parseJSON(content);
      setImportColumns(parsed.columns);
      setRawData(parsed.rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFileError(`Failed to parse file: ${message}`);
      setRawData([]);
      setImportColumns([]);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Column matching
  const columnMatches = useMemo((): ColumnMatch[] => {
    if (importColumns.length === 0) return [];

    const matches: ColumnMatch[] = [];

    // Check each import column
    importColumns.forEach((importCol) => {
      const tableCol = tableColumns.find(
        (tc) => tc.name.toLowerCase() === importCol.toLowerCase()
      );
      matches.push({
        importColumn: importCol,
        tableColumn: tableCol || null,
        status: tableCol ? "matched" : "extra",
      });
    });

    // Check for missing required columns
    tableColumns.forEach((tableCol) => {
      const hasMatch = importColumns.some(
        (ic) => ic.toLowerCase() === tableCol.name.toLowerCase()
      );
      if (!hasMatch) {
        // Check if column has a default or is nullable
        const isAutoGenerated =
          tableCol.dataType.toLowerCase().includes("serial") ||
          (tableCol.defaultValue && /\w+\s*\(/.test(tableCol.defaultValue));

        if (!isAutoGenerated && !tableCol.isNullable && !tableCol.defaultValue) {
          matches.push({
            importColumn: tableCol.name,
            tableColumn: tableCol,
            status: "missing",
          });
        }
      }
    });

    return matches;
  }, [importColumns, tableColumns]);

  // Validation
  const validation = useMemo((): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (rawData.length === 0) {
      return { isValid: true, errors, warnings };
    }

    // Check for missing required columns
    const missingRequired = columnMatches.filter((m) => m.status === "missing");
    missingRequired.forEach((m) => {
      errors.push({
        type: "missing_column",
        message: `Required column "${m.importColumn}" is missing from import file. This column has no default value and doesn't allow NULL.`,
        column: m.importColumn,
      });
    });

    // Check for extra columns (warning only)
    const extraColumns = columnMatches.filter((m) => m.status === "extra");
    extraColumns.forEach((m) => {
      warnings.push({
        type: "extra_column_ignored",
        message: `Column "${m.importColumn}" doesn't exist in table and will be ignored.`,
        column: m.importColumn,
      });
    });

    // Note: We don't validate row-level null constraints here because:
    // 1. If data was exported from this table, the null pattern is already valid
    // 2. Empty strings in CSV often represent NULLs from the source
    // 3. The database will enforce constraints on actual insert
    // We only check for structural issues (missing/extra columns)

    // Limit errors shown
    if (errors.length > 10) {
      const remaining = errors.length - 10;
      errors.splice(10);
      errors.push({
        type: "parse_error",
        message: `... and ${remaining} more errors`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [rawData, columnMatches]);

  // Stats
  const stats = useMemo(() => {
    const matched = columnMatches.filter((m) => m.status === "matched").length;
    const extra = columnMatches.filter((m) => m.status === "extra").length;
    const missing = columnMatches.filter((m) => m.status === "missing").length;

    return {
      totalRows: rawData.length,
      matchedColumns: matched,
      extraColumns: extra,
      missingColumns: missing,
    };
  }, [rawData, columnMatches]);

  // Handle import
  const handleImport = async () => {
    if (!validation.isValid) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);

    try {
      const connectionId = getCurrentConnectionId();
      if (!connectionId) throw new Error("Not connected to database");

      // Get matched columns only
      const matchedColumns = columnMatches
        .filter((m) => m.status === "matched")
        .map((m) => m.tableColumn!);

      // Prepare rows for import (only matched columns)
      const rowsToImport: Row[] = rawData.map((row) => {
        const importRow: Row = {};
        matchedColumns.forEach((col) => {
          const importKey = importColumns.find(
            (ic) => ic.toLowerCase() === col.name.toLowerCase()
          );
          if (importKey) {
            let value = row[importKey];
            // Convert empty strings to null for non-text columns
            if (value === "" && !col.dataType.toLowerCase().includes("text") && !col.dataType.toLowerCase().includes("char")) {
              value = null;
            }
            importRow[col.name] = value;
          }
        });
        return importRow;
      });

      // Import in batches
      const batchSize = 100;
      const totalBatches = Math.ceil(rowsToImport.length / batchSize);
      let importedCount = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = rowsToImport.slice(i * batchSize, (i + 1) * batchSize);

        await invoke("bulk_insert", {
          connectionId,
          schema,
          table,
          rows: batch,
        });

        importedCount += batch.length;
        setImportProgress(Math.round((importedCount / rowsToImport.length) * 100));
      }

      setImportSuccess(true);
      showToast(`Successfully imported ${importedCount.toLocaleString()} rows into ${schema}.${table}`);

      // Close tab after delay
      setTimeout(() => {
        closeTab(tab.id);
      }, 2000);
    } catch (err) {
      console.error("Import error:", err);
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      } else if (typeof err === "object" && err !== null) {
        // Handle Tauri error objects which may have various properties
        const errObj = err as Record<string, unknown>;
        message = (
          errObj.message ||
          errObj.error ||
          errObj.description ||
          errObj.msg ||
          JSON.stringify(err, null, 2)
        ) as string;
      } else {
        message = "Unknown error occurred";
      }
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  };

  // Clear file
  const handleClearFile = () => {
    setFilePath(null);
    setFileName(null);
    setRawData([]);
    setImportColumns([]);
    setFileError(null);
    setImportError(null);
    setImportSuccess(false);
  };

  // Preview rows (limit to 100)
  const previewRows = rawData.slice(0, 100);
  const hasMoreRows = rawData.length > 100;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            format === "csv" ? "bg-green-500/10" : "bg-blue-500/10"
          )}>
            {format === "csv" ? (
              <FileSpreadsheet className="w-5 h-5 text-green-400" />
            ) : (
              <FileJson className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Import {format.toUpperCase()} Data
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Into <span className="font-mono text-[var(--accent)]">{schema}.{table}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleImport}
          disabled={!validation.isValid || rawData.length === 0 || isImporting || importSuccess}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm rounded-lg",
            importSuccess
              ? "bg-green-500 text-white"
              : "bg-[var(--accent)] text-white hover:opacity-90",
            "transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing {importProgress}%
            </>
          ) : importSuccess ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Imported!
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Import {stats.totalRows > 0 && `${stats.totalRows.toLocaleString()} Rows`}
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Loading columns */}
          {isLoadingColumns && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-secondary)]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-muted)]">Loading table structure...</span>
            </div>
          )}

          {/* Columns error */}
          {columnsError && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Failed to load table structure</p>
                <p className="text-xs text-red-400/70 mt-1">{columnsError}</p>
              </div>
            </div>
          )}

          {/* Import success */}
          {importSuccess && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-400">
                  Successfully imported {stats.totalRows.toLocaleString()} rows!
                </p>
                <p className="text-xs text-green-400/70 mt-1">Closing tab...</p>
              </div>
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Import failed</p>
                <p className="text-xs text-red-400/70 mt-1 font-mono">{importError}</p>
              </div>
              <button
                onClick={() => setImportError(null)}
                className="text-red-400 hover:text-red-300"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Table Structure */}
          {!isLoadingColumns && !columnsError && (
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <Table className="w-4 h-4 text-[var(--text-muted)]" />
                <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                  Target Table Structure
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  ({tableColumns.length} columns)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tableColumns.map((col) => (
                  <div
                    key={col.name}
                    className={cn(
                      "px-2 py-1 rounded text-xs",
                      "bg-[var(--bg-tertiary)] border border-[var(--border-color)]"
                    )}
                  >
                    <span className="font-medium text-[var(--text-primary)]">{col.name}</span>
                    <span className="text-[var(--text-muted)] ml-1">
                      {col.dataType}
                      {!col.isNullable && <span className="text-amber-400 ml-1">*</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                <span className="text-amber-400">*</span> Required columns (NOT NULL without default)
              </p>
            </div>
          )}

          {/* File Selection */}
          {!isLoadingColumns && !columnsError && (
            <div className="space-y-4">
              {!filePath ? (
                <button
                  onClick={handleSelectFile}
                  disabled={isLoadingFile}
                  className={cn(
                    "w-full p-8 rounded-lg",
                    "border-2 border-dashed border-[var(--border-color)]",
                    "hover:border-[var(--accent)] hover:bg-[var(--accent)]/5",
                    "transition-colors cursor-pointer",
                    "flex flex-col items-center gap-3"
                  )}
                >
                  {isLoadingFile ? (
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
                  ) : (
                    <Upload className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {isLoadingFile ? "Loading file..." : `Select ${format.toUpperCase()} file`}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Click to browse or drag and drop
                    </p>
                  </div>
                </button>
              ) : (
                <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {format === "csv" ? (
                        <FileSpreadsheet className="w-5 h-5 text-green-400" />
                      ) : (
                        <FileJson className="w-5 h-5 text-blue-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{fileName}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {stats.totalRows.toLocaleString()} rows · {importColumns.length} columns
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectFile}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        title="Select different file"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleClearFile}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Clear file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* File error */}
              {fileError && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{fileError}</p>
                </div>
              )}
            </div>
          )}

          {/* Column Mapping */}
          {rawData.length > 0 && (
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Column Mapping
              </h3>
              <div className="space-y-2">
                {columnMatches.map((match) => (
                  <div
                    key={match.importColumn}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg",
                      match.status === "matched" && "bg-green-500/5 border border-green-500/20",
                      match.status === "extra" && "bg-amber-500/5 border border-amber-500/20",
                      match.status === "missing" && "bg-red-500/5 border border-red-500/20"
                    )}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-mono",
                        match.status === "matched" && "text-[var(--text-primary)]",
                        match.status === "extra" && "text-amber-400",
                        match.status === "missing" && "text-red-400"
                      )}>
                        {match.importColumn}
                      </span>
                      {match.status === "matched" && (
                        <>
                          <ArrowRight className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-mono text-[var(--text-primary)]">
                            {match.tableColumn?.name}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            ({match.tableColumn?.dataType})
                          </span>
                        </>
                      )}
                    </div>
                    <div className="shrink-0">
                      {match.status === "matched" && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      {match.status === "extra" && (
                        <span className="text-xs text-amber-400">Will be ignored</span>
                      )}
                      {match.status === "missing" && (
                        <span className="text-xs text-red-400">Required</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-medium text-red-400">
                  Validation Errors ({validation.errors.length})
                </h3>
              </div>
              <ul className="space-y-1">
                {validation.errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-400/90">
                    • {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-medium text-amber-400">
                  Warnings ({validation.warnings.length})
                </h3>
              </div>
              <ul className="space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-400/90">
                    • {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Preview */}
          {rawData.length > 0 && (
            <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                  Data Preview
                  {hasMoreRows && (
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      (showing first 100 of {rawData.length.toLocaleString()} rows)
                    </span>
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-tertiary)]">
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)] w-12">
                        #
                      </th>
                      {importColumns.map((col) => {
                        const match = columnMatches.find((m) => m.importColumn === col);
                        return (
                          <th
                            key={col}
                            className={cn(
                              "px-3 py-2 text-left text-xs font-medium",
                              match?.status === "matched" && "text-[var(--text-primary)]",
                              match?.status === "extra" && "text-amber-400 line-through"
                            )}
                          >
                            {col}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-[var(--bg-secondary)]">
                        <td className="px-3 py-2 text-xs text-[var(--text-muted)] sticky left-0 bg-[var(--bg-primary)]">
                          {rowIdx + 1}
                        </td>
                        {importColumns.map((col) => {
                          const value = row[col];
                          const isNull = value === null || value === undefined;
                          return (
                            <td
                              key={col}
                              className={cn(
                                "px-3 py-2 text-sm max-w-[250px]",
                                isNull ? "text-[var(--text-muted)] italic" : "text-[var(--text-primary)]"
                              )}
                              title={isNull ? "NULL" : String(value)}
                            >
                              <div className="truncate">
                                {formatCellValue(value)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCellValue(value: CellValue): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  // Replace newlines with spaces for display and limit length
  const str = String(value).replace(/[\r\n]+/g, " ");
  if (str.length > 100) {
    return str.slice(0, 100) + "...";
  }
  return str;
}
