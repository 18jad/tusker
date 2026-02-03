import { Database, Plus } from "lucide-react";
import { useUIStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

export function WelcomeScreen() {
  const { openProjectModal } = useUIStore();
  const { projects, connectionStatus } = useProjectStore();

  const hasProjects = projects.length > 0;
  const isConnected = connectionStatus === "connected";

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-[var(--bg-secondary)] p-6">
            <Database className="h-12 w-12 text-[var(--text-muted)]" />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-[var(--text-primary)]">
          {!hasProjects
            ? "Welcome to Tusker"
            : !isConnected
              ? "Connect to a Database"
              : "Select a Table"}
        </h1>

        <p className="mb-8 text-[var(--text-secondary)]">
          {!hasProjects
            ? "Create your first project to connect to a PostgreSQL database and start exploring your data."
            : !isConnected
              ? "Select a project from the sidebar to connect and view your database tables."
              : "Click on a table in the sidebar to view and edit its data."}
        </p>

        {!hasProjects && (
          <button
            onClick={() => openProjectModal()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        )}

        <div className="mt-12 flex justify-center gap-8 text-sm text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <kbd className="rounded bg-[var(--bg-tertiary)] px-2 py-1 font-mono text-xs">
              ⌘K
            </kbd>
            <span>Command palette</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded bg-[var(--bg-tertiary)] px-2 py-1 font-mono text-xs">
              ⌘B
            </kbd>
            <span>Toggle sidebar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
