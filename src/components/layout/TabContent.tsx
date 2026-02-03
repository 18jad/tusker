import { useState, useMemo, useEffect, useRef } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useChangesStore } from "../../stores/changesStore";
import { useTableData, useCommitChanges } from "../../hooks/useDatabase";
import { TableView } from "../table/TableView";
import { RowDetailModal } from "../table/RowDetailModal";
import { generateUpdateSQL, generateDeleteSQL } from "../../lib/sql";
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
  const commitChanges = useCommitChanges();
  const addChange = useChangesStore((state) => state.addChange);
  const allChanges = useChangesStore((state) => state.changes);

  // Row detail modal state
  const [viewingRowIndex, setViewingRowIndex] = useState<number | null>(null);

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

  // Handle row view/edit
  const handleRowView = (rowIndex: number) => {
    setViewingRowIndex(rowIndex);
  };

  // Handle row delete (stage)
  const handleRowDelete = (rowIndex: number) => {
    if (!data) return;

    const originalRow = data.rows[rowIndex];
    const columns = data.columns;

    // Generate DELETE SQL
    const sql = generateDeleteSQL(schema, table, originalRow, columns);

    // Stage the delete change
    addChange({
      type: "delete",
      schema,
      table,
      data: originalRow,
      originalData: originalRow,
      sql,
    });
  };

  // Handle direct save from row detail modal
  const handleRowSave = async (updatedRow: Row) => {
    if (!data || viewingRowIndex === null) return;

    const originalRow = data.rows[viewingRowIndex];
    const columns = data.columns;

    // Find changed columns
    const changedData: Row = {};
    Object.keys(updatedRow).forEach((key) => {
      if (updatedRow[key] !== originalRow[key]) {
        changedData[key] = updatedRow[key];
      }
    });

    if (Object.keys(changedData).length === 0) return;

    // Generate SQL
    const sql = generateUpdateSQL(schema, table, changedData, originalRow, columns);

    // Direct save - execute immediately
    try {
      await commitChanges.mutateAsync([sql]);
      refetch();
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  // Handle stage from row detail modal
  const handleRowStage = (updatedRow: Row) => {
    if (!data || viewingRowIndex === null) return;

    const originalRow = data.rows[viewingRowIndex];
    const columns = data.columns;

    // Find changed columns
    const changedData: Row = {};
    Object.keys(updatedRow).forEach((key) => {
      if (updatedRow[key] !== originalRow[key]) {
        changedData[key] = updatedRow[key];
      }
    });

    if (Object.keys(changedData).length === 0) return;

    // Update local edits for visual feedback
    Object.entries(changedData).forEach(([colName, value]) => {
      const editKey = `${viewingRowIndex}:${colName}`;
      setLocalEdits((prev) => {
        const next = new Map(prev);
        next.set(editKey, value);
        return next;
      });
    });

    // Generate SQL and stage
    const sql = generateUpdateSQL(schema, table, changedData, originalRow, columns);
    addChange({
      type: "update",
      schema,
      table,
      data: changedData,
      originalData: originalRow,
      sql,
    });
  };

  // Handle delete from row detail modal
  const handleRowDeleteFromModal = () => {
    if (viewingRowIndex !== null) {
      handleRowDelete(viewingRowIndex);
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

  // Build set of deleted row indices
  const deletedRows = useMemo(() => {
    const deleted = new Set<number>();
    changes.forEach((change) => {
      if (change.type === "delete" && change.originalData) {
        // Find the row index by matching original data
        const rowIndex = data?.rows.findIndex((row) => {
          return Object.entries(change.originalData || {}).every(
            ([key, val]) => row[key] === val
          );
        });
        if (rowIndex !== undefined && rowIndex >= 0) {
          deleted.add(rowIndex);
        }
      }
    });
    return deleted;
  }, [changes, data]);

  const handleRefresh = () => {
    setLocalEdits(new Map());
    refetch();
  };

  // Get the row data for the modal
  const viewingRow = viewingRowIndex !== null && mergedData?.rows[viewingRowIndex]
    ? mergedData.rows[viewingRowIndex]
    : null;

  const isViewingRowDeleted = viewingRowIndex !== null && deletedRows.has(viewingRowIndex);

  return (
    <>
      <TableView
        tableKey={`${schema}.${table}`}
        tableName={table}
        data={mergedData}
        isLoading={isLoading}
        error={error ? (error instanceof Error ? error.message : String(error)) : null}
        onPageChange={handlePageChange}
        onCellEdit={handleCellEdit}
        onRowView={handleRowView}
        onRowDelete={handleRowDelete}
        onRefresh={handleRefresh}
        editedCells={editedCells}
        deletedRows={deletedRows}
        readOnly={readOnly}
      />

      {/* Row detail modal */}
      {viewingRow && data && (
        <RowDetailModal
          row={viewingRow}
          rowIndex={viewingRowIndex!}
          columns={data.columns}
          isOpen={viewingRowIndex !== null}
          onClose={() => setViewingRowIndex(null)}
          onSave={handleRowSave}
          onStage={handleRowStage}
          onDelete={handleRowDeleteFromModal}
          readOnly={readOnly}
          isDeleted={isViewingRowDeleted}
        />
      )}
    </>
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
