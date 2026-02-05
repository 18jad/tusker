import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Table2,
  Clock,
  Hash,
  Columns,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileJson,
  Loader2,
} from "lucide-react";
import { cn, formatCellValue, modKeyName } from "../../lib/utils";
import type { Row, Column } from "../../types";

interface QueryResult {
  rows: Row[];
  columns: Column[];
  rowsAffected?: number;
  executionTime: number;
}

interface QueryResultsProps {
  result: QueryResult | null;
  error: string | null;
  isLoading: boolean;
  onExport?: (format: "csv" | "json") => void;
}

export function QueryResults({
  result,
  error,
  isLoading,
  onExport,
}: QueryResultsProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Results</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[var(--accent)]" />
          <p className="text-sm">Executing query...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="text-xs font-medium text-red-400 uppercase tracking-wide">Error</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400 mb-2">Query Error</p>
              <pre className="text-sm text-red-300/90 whitespace-pre-wrap font-mono bg-red-950/20 p-3 rounded overflow-x-auto">
                {error}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No result yet
  if (!result) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Results</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Table2 className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm">Run a query to see results</p>
          <p className="text-xs mt-1 opacity-60">Press {modKeyName}+Enter to execute</p>
        </div>
      </div>
    );
  }

  // Mutation result (INSERT, UPDATE, DELETE)
  if (result.rows.length === 0 && result.rowsAffected !== undefined) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-start gap-3 p-6 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <p className="text-base font-medium text-green-400">
                Query executed successfully
              </p>
              <p className="text-sm text-green-400/70 mt-1">
                {result.rowsAffected} row{result.rowsAffected !== 1 ? "s" : ""} affected
              </p>
            </div>
          </div>
        </div>
        <StatusBar result={result} />
      </div>
    );
  }

  // SELECT result with data
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <ResultTable rows={result.rows} columns={result.columns} />
      </div>
      <StatusBar
        result={result}
        onExport={onExport}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
      />
    </div>
  );
}

interface ResultTableProps {
  rows: Row[];
  columns: Column[];
}

function ResultTable({ rows, columns }: ResultTableProps) {
  // Build column definitions from the first row if columns not provided
  const columnNames = useMemo(() => {
    if (columns.length > 0) {
      return columns.map((c) => c.name);
    }
    if (rows.length > 0) {
      return Object.keys(rows[0]);
    }
    return [];
  }, [columns, rows]);

  if (columnNames.length === 0) {
    return (
      <div className="p-4 text-center text-[var(--text-muted)] text-sm">
        No columns in result
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="bg-[var(--bg-secondary)]">
          {/* Row number column */}
          <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)] border-b border-r border-[var(--border-color)] bg-[var(--bg-secondary)] w-12">
            #
          </th>
          {columnNames.map((name) => (
            <th
              key={name}
              className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] border-b border-r border-[var(--border-color)] bg-[var(--bg-secondary)] whitespace-nowrap"
            >
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className="hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {/* Row number */}
            <td className="px-3 py-1.5 text-right text-xs text-[var(--text-muted)] border-b border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/50 font-mono">
              {rowIndex + 1}
            </td>
            {columnNames.map((name) => (
              <td
                key={name}
                className={cn(
                  "px-3 py-1.5 border-b border-r border-[var(--border-color)]",
                  "font-mono text-xs max-w-[300px] truncate",
                  row[name] === null && "text-[var(--text-muted)] italic"
                )}
                title={formatCellValue(row[name])}
              >
                {formatCellValue(row[name])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface StatusBarProps {
  result: QueryResult;
  onExport?: (format: "csv" | "json") => void;
  showExportMenu?: boolean;
  setShowExportMenu?: (show: boolean) => void;
}

function StatusBar({
  result,
  onExport,
  showExportMenu,
  setShowExportMenu,
}: StatusBarProps) {
  const columnCount = result.columns.length || (result.rows[0] ? Object.keys(result.rows[0]).length : 0);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs text-[var(--text-muted)] shrink-0">
      <div className="flex items-center gap-4">
        {/* Execution time */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{result.executionTime}ms</span>
        </div>

        {/* Row count */}
        <div className="flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5" />
          <span>
            {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Column count */}
        {columnCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Columns className="w-3.5 h-3.5" />
            <span>
              {columnCount} column{columnCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Export button */}
      {onExport && result.rows.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowExportMenu?.(!showExportMenu)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded",
              "hover:bg-[var(--bg-tertiary)] transition-colors",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showExportMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowExportMenu?.(false)}
              />
              <div className="absolute bottom-full right-0 mb-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                <button
                  onClick={() => {
                    onExport("csv");
                    setShowExportMenu?.(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => {
                    onExport("json");
                    setShowExportMenu?.(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <FileJson className="w-4 h-4" />
                  Export JSON
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
