import { useState, useEffect, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";

type UpdateStatus = "idle" | "available" | "downloading" | "installed" | "error";

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number;
  error: string | null;
  dismissed: boolean;
}

export function useUpdateCheck() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    version: null,
    progress: 0,
    error: null,
    dismissed: false,
  });
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const result = await check();
        if (cancelled) return;

        if (result) {
          setState((s) => ({
            ...s,
            status: "available",
            version: result.version,
          }));
          setUpdate(result);
        }
      } catch {
        // Silent fail — don't disrupt offline users
      }
    }

    checkForUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;

    setState((s) => ({ ...s, status: "downloading", progress: 0 }));

    try {
      let totalLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalLength = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (totalLength > 0) {
            setState((s) => ({
              ...s,
              progress: Math.round((downloaded / totalLength) * 100),
            }));
          }
        } else if (event.event === "Finished") {
          setState((s) => ({ ...s, status: "installed", progress: 100 }));
        }
      });

      setState((s) => ({ ...s, status: "installed", progress: 100 }));
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "error",
        error: e instanceof Error ? e.message : "Update failed",
      }));
    }
  }, [update]);

  const checkNow = useCallback(async (): Promise<{ available: boolean; version?: string; error?: string }> => {
    setState((s) => ({ ...s, status: "idle", error: null }));

    try {
      const result = await check();
      if (result) {
        setState((s) => ({
          ...s,
          status: "available",
          version: result.version,
          dismissed: false,
        }));
        setUpdate(result);
        return { available: true, version: result.version };
      } else {
        setState((s) => ({ ...s, status: "idle" }));
        return { available: false };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "Update check failed";
      setState((s) => ({
        ...s,
        status: "error",
        error,
      }));
      return { available: false, error };
    }
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, dismissed: true }));
  }, []);

  return {
    ...state,
    installUpdate,
    checkNow,
    dismiss,
  };
}
