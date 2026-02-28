import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useProjectStore } from "../stores/projectStore";
import type { Schema } from "../types";

const PING_INTERVAL_MS = 30_000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2_000;
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SchemaWithTables {
  name: string;
  owner: string | null;
  tables: Array<{
    name: string;
    schema: string;
    table_type: string;
    estimated_row_count: number | null;
    description: string | null;
  }>;
}

function convertSchemasWithTables(raw: SchemaWithTables[]): Schema[] {
  return raw
    .filter((s) => !s.name.startsWith("pg_") && s.name !== "information_schema")
    .map((s) => ({
      name: s.name,
      tables: s.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.estimated_row_count ?? undefined,
      })),
    }));
}

export function useConnectionHealthCheck() {
  const connections = useProjectStore((state) => state.connections);
  const focusedRef = useRef(true);
  const lastActivityRef = useRef(Date.now());
  // Track which projectIds are currently reconnecting
  const reconnectingRef = useRef<Set<string>>(new Set());
  // Track interval IDs per projectId
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Track window focus
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    (async () => {
      const unlistenFocus = await appWindow.onFocusChanged(({ payload: focused }) => {
        focusedRef.current = focused;
        if (focused) lastActivityRef.current = Date.now();
      });
      unlisten = unlistenFocus;
    })();

    return () => unlisten?.();
  }, []);

  // Track user activity
  useEffect(() => {
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("mousedown", onActivity);
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("mousedown", onActivity);
    };
  }, []);

  // Set up per-connection ping intervals
  useEffect(() => {
    const currentProjectIds = new Set(Object.keys(connections));
    const intervals = intervalsRef.current;

    // Remove intervals for connections that no longer exist
    for (const [projectId, intervalId] of intervals) {
      if (!currentProjectIds.has(projectId)) {
        clearInterval(intervalId);
        intervals.delete(projectId);
        reconnectingRef.current.delete(projectId);
      }
    }

    // Set up intervals for new/existing connected projects
    for (const [projectId, conn] of Object.entries(connections)) {
      // Only monitor connections that are in "connected" state
      if (conn.status !== "connected") {
        // Clear interval if connection is no longer in connected state
        // (e.g., user disconnected manually, or status changed to error)
        const existing = intervals.get(projectId);
        if (existing) {
          clearInterval(existing);
          intervals.delete(projectId);
          reconnectingRef.current.delete(projectId);
        }
        continue;
      }

      // Already have an interval for this connected project
      if (intervals.has(projectId)) continue;

      const intervalId = setInterval(async () => {
        await pingAndReconnect(projectId, focusedRef, lastActivityRef, reconnectingRef);
      }, PING_INTERVAL_MS);

      intervals.set(projectId, intervalId);
    }

    // Cleanup ALL intervals on unmount
    return () => {
      for (const [, intervalId] of intervals) {
        clearInterval(intervalId);
      }
      intervals.clear();
      reconnectingRef.current.clear();
    };
  }, [connections]);
}

async function pingAndReconnect(
  projectId: string,
  focusedRef: React.RefObject<boolean>,
  lastActivityRef: React.RefObject<number>,
  reconnectingRef: React.RefObject<Set<string>>,
) {
  // Already reconnecting this project
  if (reconnectingRef.current.has(projectId)) return;

  // Skip ping if window is unfocused or user is idle
  if (!focusedRef.current) return;
  if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) return;

  const store = useProjectStore.getState();
  const conn = store.connections[projectId];
  if (!conn || conn.status !== "connected") return;

  const { connectionId } = conn;

  let alive = false;
  try {
    alive = await invoke<boolean>("ping_database", { connectionId });
  } catch {
    alive = false;
  }

  if (alive) return;

  // Connection is dead - attempt reconnection
  reconnectingRef.current.add(projectId);

  // Re-check status in case it changed while we were pinging
  const freshConn = useProjectStore.getState().connections[projectId];
  if (!freshConn || freshConn.status !== "connected") {
    reconnectingRef.current.delete(projectId);
    return;
  }

  store.setProjectConnectionStatus(projectId, "reconnecting");

  // Disconnect the stale connection
  try {
    await invoke("disconnect", { connectionId });
  } catch {
    // ignore - connection may already be gone
  }

  const project = store.getProject(projectId);
  if (!project) {
    store.setProjectConnectionStatus(projectId, "disconnected");
    store.setProjectSchemas(projectId, []);
    store.setProjectError(projectId, "No project config found for reconnection");
    reconnectingRef.current.delete(projectId);
    return;
  }

  let reconnected = false;
  let newConnectionId: string | null = null;

  for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
    // Bail if user disconnected or changed status during retries
    const currentConn = useProjectStore.getState().connections[projectId];
    if (!currentConn || currentConn.status !== "reconnecting") {
      reconnectingRef.current.delete(projectId);
      return;
    }

    try {
      const result = await invoke<{ connection_id: string }>("connect_saved", {
        connectionId: project.id,
      });

      // Verify the new connection actually works
      const ok = await invoke<boolean>("ping_database", {
        connectionId: result.connection_id,
      });

      if (ok) {
        reconnected = true;
        newConnectionId = result.connection_id;
        break;
      }
    } catch {
      // attempt failed
    }

    if (attempt < RECONNECT_ATTEMPTS - 1) {
      await sleep(RECONNECT_DELAY_MS);
    }
  }

  if (reconnected && newConnectionId) {
    // Only update if we're still in reconnecting state for this project
    const finalConn = useProjectStore.getState().connections[projectId];
    if (finalConn?.status === "reconnecting") {
      // Re-register the connection with the new connectionId
      useProjectStore.getState().connectProject(projectId, newConnectionId);
      useProjectStore.getState().setProjectError(projectId, null);

      // Re-fetch schemas for this project
      try {
        const raw = await invoke<SchemaWithTables[]>("get_schemas_with_tables", {
          connectionId: newConnectionId,
        });
        useProjectStore.getState().setProjectSchemas(projectId, convertSchemasWithTables(raw));
      } catch (err) {
        console.error(`Failed to re-fetch schemas for project ${projectId}:`, err);
      }
    }
  } else {
    const finalConn = useProjectStore.getState().connections[projectId];
    if (finalConn?.status === "reconnecting") {
      useProjectStore.getState().setProjectConnectionStatus(projectId, "disconnected");
      useProjectStore.getState().setProjectSchemas(projectId, []);
      useProjectStore.getState().setProjectError(
        projectId,
        "Connection lost. Reconnection failed after multiple attempts."
      );
    }
  }

  reconnectingRef.current.delete(projectId);
}
