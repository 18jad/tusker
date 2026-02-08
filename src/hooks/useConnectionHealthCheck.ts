import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useProjectStore } from "../stores/projectStore";
import { getCurrentConnectionId, setCurrentConnectionId } from "./useDatabase";

const PING_INTERVAL_MS = 30_000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2_000;
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useConnectionHealthCheck() {
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const setConnectionStatus = useProjectStore((state) => state.setConnectionStatus);
  const setSchemas = useProjectStore((state) => state.setSchemas);
  const setError = useProjectStore((state) => state.setError);
  const getActiveProject = useProjectStore((state) => state.getActiveProject);
  const reconnectingRef = useRef(false);
  const focusedRef = useRef(true);
  const lastActivityRef = useRef(Date.now());

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

  // Ping loop
  useEffect(() => {
    if (connectionStatus !== "connected") return;

    const intervalId = setInterval(async () => {
      if (reconnectingRef.current) return;

      // Skip ping if window is unfocused or user is idle
      if (!focusedRef.current) return;
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) return;

      const connectionId = getCurrentConnectionId();
      if (!connectionId) return;

      let alive = false;
      try {
        alive = await invoke<boolean>("ping_database", { connectionId });
      } catch {
        alive = false;
      }

      if (alive) return;

      // Connection is dead — attempt reconnection
      reconnectingRef.current = true;

      // Bail if status changed while we were checking
      if (useProjectStore.getState().connectionStatus !== "connected") {
        reconnectingRef.current = false;
        return;
      }

      setConnectionStatus("reconnecting");

      // Disconnect the stale connection
      try {
        await invoke("disconnect", { connectionId });
      } catch {
        // ignore — connection may already be gone
      }
      setCurrentConnectionId(null);

      const activeProject = getActiveProject();
      if (!activeProject) {
        setConnectionStatus("disconnected");
        setSchemas([]);
        setError("No active project for reconnection");
        reconnectingRef.current = false;
        return;
      }

      let reconnected = false;

      for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
        // Bail if user disconnected or changed status during retries
        const currentStatus = useProjectStore.getState().connectionStatus;
        if (currentStatus !== "reconnecting") {
          reconnectingRef.current = false;
          return;
        }

        try {
          const result = await invoke<{ connection_id: string }>("connect_saved", {
            connectionId: activeProject.id,
          });
          setCurrentConnectionId(result.connection_id);

          // Verify the new connection actually works
          const ok = await invoke<boolean>("ping_database", {
            connectionId: result.connection_id,
          });

          if (ok) {
            reconnected = true;
            break;
          }
        } catch {
          // attempt failed
        }

        if (attempt < RECONNECT_ATTEMPTS - 1) {
          await sleep(RECONNECT_DELAY_MS);
        }
      }

      if (reconnected) {
        // Only update if we're still in reconnecting state
        if (useProjectStore.getState().connectionStatus === "reconnecting") {
          setConnectionStatus("connected");
          setError(null);
        }
      } else {
        if (useProjectStore.getState().connectionStatus === "reconnecting") {
          setConnectionStatus("disconnected");
          setSchemas([]);
          setError("Connection lost. Reconnection failed after multiple attempts.");
        }
      }

      reconnectingRef.current = false;
    }, PING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [connectionStatus, setConnectionStatus, setSchemas, setError, getActiveProject]);
}
