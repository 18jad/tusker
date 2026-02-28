import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Row } from "../types";

type ExportFormat = "csv" | "json";

interface PaginatedResult {
  rows: Row[];
  total_count: number;
}

export async function exportTable(
  connectionId: string,
  schema: string,
  table: string,
  format: ExportFormat,
  onSuccess: (message: string) => void,
  onError: (message: string) => void
) {
  try {

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
    onSuccess(`Exported ${rows.length.toLocaleString()} rows to ${format.toUpperCase()}`);
  } catch (err) {
    console.error("Export error:", err);
    const message = err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err);
    onError(message);
  }
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
