import { useState, useMemo, useEffect, useRef } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useChangesStore } from "../../stores/changesStore";
import { useTableData } from "../../hooks/useDatabase";
import { TableView } from "../table/TableView";
import { generateUpdateSQL } from "../../lib/sql";
import type { CellValue, Row } from "../../types";

/**
 * Renders the content for a single table tab
 */
function TableTabContent({ schema, table }: { schema: string; table: string }) {
  const [page, setPage] = useState(1);
  const activeProject = useProjectStore((state) => state.getActiveProject());
  const readOnly = activeProject?.settings.readOnly ?? false;
  const instantCommit = activeProject?.settings.instantCommit ?? false;

  const { data, isLoading, error, refetch } = useTableData(schema, table, page);
  const addChange = useChangesStore((state) => state.addChange);
  const allChanges = useChangesStore((state) => state.changes);

  // Filter changes for this table - do this in useMemo to avoid infinite re-renders
  const changes = useMemo(() =>
    allChanges.filter((c) => c.schema === schema && c.table === table),
    [allChanges, schema, table]
  );

  // Track previous changes count to detect commits
  const prevChangesCount = useRef(changes.length);

  // Clear local edits when staged changes are committed (changes go from >0 to 0)
  useEffect(() => {
    if (prevChangesCount.current > 0 && changes.length === 0) {
      // Changes were cleared (commit happened), clear local edits and refetch
      setLocalEdits(new Map());
      refetch();
    }
    prevChangesCount.current = changes.length;
  }, [changes.length, refetch]);

  // Track local edits (before they're committed)
  const [localEdits, setLocalEdits] = useState<Map<string, CellValue>>(new Map());

  // Merge fetched data with local edits AND staged changes
  const mergedData = useMemo(() => {
    if (!data) return null;

    const mergedRows = data.rows.map((row, rowIndex) => {
      const mergedRow = { ...row };

      // First apply staged changes (for values that persist across tab switches)
      changes.forEach((change) => {
        if (change.type === "update" && change.originalData) {
          // Check if this change applies to this row by matching original data
          const isMatch = Object.entries(change.originalData).every(
            ([key, val]) => row[key] === val
          );
          if (isMatch) {
            Object.entries(change.data).forEach(([colName, value]) => {
              mergedRow[colName] = value;
            });
          }
        }
      });

      // Then apply local edits (for immediate feedback on current session)
      localEdits.forEach((value, key) => {
        const [editRowIndex, colName] = key.split(":");
        if (parseInt(editRowIndex) === rowIndex) {
          mergedRow[colName] = value;
        }
      });

      return mergedRow;
    });

    return {
      ...data,
      rows: mergedRows,
    };
  }, [data, localEdits, changes]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Clear local edits when changing page
    setLocalEdits(new Map());
  };

  const handleCellEdit = (rowIndex: number, columnName: string, newValue: CellValue) => {
    if (!data) return;

    const originalRow = data.rows[rowIndex];
    const columns = data.columns;

    // Update local state immediately for visual feedback
    const editKey = `${rowIndex}:${columnName}`;
    setLocalEdits((prev) => {
      const next = new Map(prev);
      next.set(editKey, newValue);
      return next;
    });

    // Create the updated row data
    const updatedData: Row = { [columnName]: newValue };

    // Generate SQL for this change
    const sql = generateUpdateSQL(schema, table, updatedData, originalRow, columns);

    // Stage the change
    addChange({
      type: "update",
      schema,
      table,
      data: updatedData,
      originalData: originalRow,
      sql,
    });

    // TODO: If instantCommit is enabled, execute immediately
    if (instantCommit) {
      console.log("Instant commit enabled - would execute:", sql);
    }
  };

  // Build set of edited cells for visual indication
  const editedCells = useMemo(() => {
    const edited = new Set<string>();
    localEdits.forEach((_, key) => {
      edited.add(key);
    });
    // Also mark cells from staged changes
    changes.forEach((change) => {
      if (change.type === "update" && change.originalData) {
        // Find the row index by matching original data
        const rowIndex = data?.rows.findIndex((row) => {
          // Match by primary key or first few columns
          return Object.entries(change.originalData || {}).every(
            ([key, val]) => row[key] === val
          );
        });
        if (rowIndex !== undefined && rowIndex >= 0) {
          Object.keys(change.data).forEach((colName) => {
            edited.add(`${rowIndex}:${colName}`);
          });
        }
      }
    });
    return edited;
  }, [localEdits, changes, data]);

  const handleRefresh = () => {
    setLocalEdits(new Map());
    refetch();
  };

  return (
    <TableView
      tableKey={`${schema}.${table}`}
      tableName={table}
      data={mergedData}
      isLoading={isLoading}
      error={error ? (error instanceof Error ? error.message : String(error)) : null}
      onPageChange={handlePageChange}
      onCellEdit={handleCellEdit}
      onRefresh={handleRefresh}
      editedCells={editedCells}
      readOnly={readOnly}
    />
  );
}

/**
 * Renders content based on the active tab
 */
export function TabContent() {
  const tabs = useUIStore((state) => state.tabs);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // No active tab
  if (!activeTab) {
    return null;
  }

  // Not connected
  if (connectionStatus !== "connected") {
    return null;
  }

  // Render based on tab type
  if (activeTab.type === "table" && activeTab.schema && activeTab.table) {
    return (
      <TableTabContent
        key={`${activeTab.schema}.${activeTab.table}`}
        schema={activeTab.schema}
        table={activeTab.table}
      />
    );
  }

  // Query tab (TODO: implement)
  if (activeTab.type === "query") {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        Query editor coming soon...
      </div>
    );
  }

  return null;
}
