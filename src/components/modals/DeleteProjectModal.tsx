import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useChangesStore } from "../../stores/changesStore";
import { useDisconnect } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";

export function DeleteProjectModal() {
  const { deleteProjectModal, closeDeleteProjectModal, closeAllTabs, showToast } = useUIStore();
  const { isOpen, projectId } = deleteProjectModal;
  const { projects, activeProjectId, connectionStatus, deleteProject } = useProjectStore();
  const { clearChanges } = useChangesStore();
  const disconnect = useDisconnect();
  const [isDeleting, setIsDeleting] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const isActive = projectId === activeProjectId;

  const handleDelete = async () => {
    if (!projectId || !project) return;

    setIsDeleting(true);
    try {
      if (isActive && connectionStatus === "connected") {
        await disconnect.mutateAsync();
      }

      if (isActive) {
        closeAllTabs();
        clearChanges();
      }

      deleteProject(projectId);
      closeDeleteProjectModal();
      showToast(`Deleted "${project.name}"`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeDeleteProjectModal}
      showCloseButton={false}
      className="max-w-md"
    >
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Delete project?
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            This will permanently delete{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {project?.name}
            </span>{" "}
            and its saved credentials.
            {isActive && " You will be disconnected from the database."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={closeDeleteProjectModal}
            disabled={isDeleting}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors",
              "disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "flex items-center justify-center gap-2",
              "bg-red-600 text-white hover:bg-red-700",
              "transition-all duration-150",
              "disabled:opacity-50"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
