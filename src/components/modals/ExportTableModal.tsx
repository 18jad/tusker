import { useState, useEffect } from "react";
import { Loader2, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { getCurrentConnectionId } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import type { Row } from "../../types";

type ExportFormat = "csv" | "json";

interface PaginatedResult {
  rows: Row[];
  total_count: number;
}

export function ExportTableModal() {
  const { exportTableModal, closeExportTableModal, showToast } = useUIStore();
  const { isOpen, schema, table, rowCount } = exportTableModal;
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFormat("csv");
      setError(null);
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!schema || !table) return;

    setIsExporting(true);
    setError(null);

    try {
      const connectionId = getCurrentConnectionId();
      if (!connectionId) throw new Error("Not connected");

      const defaultFilename = format === "csv"
        ? `${schema}_${table}.csv`
        : `${schema}_${table}.json`;

      // Show save dialog
      const filePath = await save({
        defaultPath: defaultFilename,
        filters: format === "csv"
          ? [{ name: "CSV", extensions: ["csv"] }]
          : [{ name: "JSON", extensions: ["json"] }],
      });

      if (!filePath) {
        // User cancelled
        setIsExporting(false);
        return;
      }

      // Fetch all rows
      const result = await invoke<PaginatedResult>("fetch_table_data", {
        request: {
          connection_id: connectionId,
          schema,
          table,
          page: 1,
          page_size: 100000, // Large number to get all rows
        },
      });

      const rows = result.rows;

      let content: string;
      if (format === "csv") {
        content = convertToCSV(rows);
      } else {
        content = JSON.stringify(rows, null, 2);
      }

      // Write file
      await writeTextFile(filePath, content);
      closeExportTableModal();
      showToast(`Exported ${rows.length.toLocaleString()} rows to ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Export error:", err);
      const message = err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeExportTableModal}
      showCloseButton={false}
      className="max-w-sm"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Export table
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Export{" "}
            <span className="font-mono text-[var(--accent)]">{schema}.{table}</span>
            {rowCount !== null && rowCount > 0 && (
              <span> ({rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"})</span>
            )}
          </p>
        </div>

        {/* Format Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFormat("csv")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-[4px] border transition-all",
              format === "csv"
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
            )}
          >
            <FileSpreadsheet className={cn(
              "w-8 h-8",
              format === "csv" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
            )} />
            <span className={cn(
              "text-sm font-medium",
              format === "csv" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
            )}>
              CSV
            </span>
          </button>
          <button
            onClick={() => setFormat("json")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-[4px] border transition-all",
              format === "json"
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
            )}
          >
            <FileJson className={cn(
              "w-8 h-8",
              format === "json" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
            )} />
            <span className={cn(
              "text-sm font-medium",
              format === "json" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
            )}>
              JSON
            </span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-3 py-2.5 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeExportTableModal}
            disabled={isExporting}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors",
              "disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "flex items-center justify-center gap-2",
              "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
              "transition-all duration-150",
              "disabled:opacity-50"
            )}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              "Export"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function convertToCSV(rows: Row[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCSVValue).join(","));

  // Data rows
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      return escapeCSVValue(value);
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let stringValue: string;
  if (typeof value === "object") {
    stringValue = JSON.stringify(value);
  } else {
    stringValue = String(value);
  }

  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

