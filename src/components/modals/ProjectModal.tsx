import { useState, useEffect } from "react";
import { Plug, Database, ChevronRight } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Toggle } from "../ui/Toggle";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useTestConnection } from "../../hooks/useDatabase";
import {
  cn,
  generateId,
  PROJECT_COLORS,
  parseConnectionString,
  buildConnectionString,
} from "../../lib/utils";
import type { Project, ProjectColor, ConnectionConfig } from "../../types";

type ConnectionMethod = "string" | "manual";

interface FormState {
  name: string;
  color: ProjectColor;
  connectionMethod: ConnectionMethod;
  connectionString: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  instantCommit: boolean;
  readOnly: boolean;
}

const INITIAL_FORM_STATE: FormState = {
  name: "",
  color: "blue",
  connectionMethod: "manual",
  connectionString: "",
  host: "localhost",
  port: "5432",
  database: "",
  username: "postgres",
  password: "",
  ssl: false,
  instantCommit: false,
  readOnly: false,
};

const PROJECT_COLOR_OPTIONS: ProjectColor[] = [
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
];

export function ProjectModal() {
  const { projectModalOpen, editingProjectId, closeProjectModal } =
    useUIStore();
  const { projects, addProject, updateProject } = useProjectStore();

  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const editingProject = editingProjectId
    ? projects.find((p) => p.id === editingProjectId)
    : null;
  const isEditing = !!editingProject;

  useEffect(() => {
    if (projectModalOpen) {
      if (editingProject) {
        const conn = editingProject.connection;
        setForm({
          name: editingProject.name,
          color: editingProject.color,
          connectionMethod: "manual",
          connectionString: buildConnectionString(conn),
          host: conn.host,
          port: String(conn.port),
          database: conn.database,
          username: conn.username,
          password: conn.password,
          ssl: conn.ssl,
          instantCommit: editingProject.settings.instantCommit,
          readOnly: editingProject.settings.readOnly,
        });
      } else {
        setForm(INITIAL_FORM_STATE);
      }
      setTestResult(null);
    }
  }, [projectModalOpen, editingProject]);

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleConnectionStringChange = (value: string) => {
    updateField("connectionString", value);
    const parsed = parseConnectionString(value);
    if (parsed) {
      setForm((prev) => ({
        ...prev,
        connectionString: value,
        host: parsed.host,
        port: String(parsed.port),
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
      }));
    }
  };

  const getConnectionConfig = (): ConnectionConfig => {
    if (form.connectionMethod === "string") {
      const parsed = parseConnectionString(form.connectionString);
      if (parsed) {
        return { ...parsed, ssl: form.ssl };
      }
    }
    return {
      host: form.host,
      port: parseInt(form.port) || 5432,
      database: form.database,
      username: form.username,
      password: form.password,
      ssl: form.ssl,
    };
  };

  const testConnection = useTestConnection();

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const config = getConnectionConfig();
      await testConnection.mutateAsync(config);
      setTestResult({ success: true, message: "Connection successful" });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to connect to database",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      const connection = getConnectionConfig();
      const projectData: Omit<Project, "id" | "createdAt"> = {
        name: form.name.trim(),
        color: form.color,
        connection,
        settings: {
          instantCommit: form.instantCommit,
          readOnly: form.readOnly,
        },
      };

      if (isEditing && editingProjectId) {
        updateProject(editingProjectId, projectData);
      } else {
        const newProject: Project = {
          ...projectData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        addProject(newProject);
      }

      closeProjectModal();
    } finally {
      setSaving(false);
    }
  };

  const isValid =
    form.name.trim() &&
    (form.connectionMethod === "string"
      ? form.connectionString.trim()
      : form.host && form.database && form.username);

  return (
    <Modal
      open={projectModalOpen}
      onClose={closeProjectModal}
      title={isEditing ? "Edit Project" : "New Project"}
      className="max-w-xl"
    >
      <div className="space-y-6">
        {/* Project Name */}
        <Input
          label="Project Name"
          placeholder="My Database"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
        />

        {/* Color Picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Project Color
          </label>
          <div className="flex gap-2">
            {PROJECT_COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateField("color", color)}
                className={cn(
                  "w-8 h-8 rounded-full transition-all duration-150",
                  PROJECT_COLORS[color].dot,
                  form.color === color
                    ? "ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white/50 scale-110"
                    : "hover:scale-105"
                )}
              />
            ))}
          </div>
        </div>

        {/* Connection Method Toggle */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Connection Method
          </label>
          <div className="flex rounded-lg border border-[var(--border-color)] p-1 bg-[var(--bg-tertiary)]">
            <button
              type="button"
              onClick={() => updateField("connectionMethod", "manual")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                form.connectionMethod === "manual"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Database className="w-4 h-4" />
              Manual
            </button>
            <button
              type="button"
              onClick={() => updateField("connectionMethod", "string")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                form.connectionMethod === "string"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Plug className="w-4 h-4" />
              Connection String
            </button>
          </div>
        </div>

        {/* Connection Fields */}
        {form.connectionMethod === "string" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Connection String
            </label>
            <textarea
              value={form.connectionString}
              onChange={(e) => handleConnectionStringChange(e.target.value)}
              placeholder="postgresql://user:password@localhost:5432/database"
              rows={3}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-mono resize-none",
                "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
                "border border-[var(--border-color)]",
                "placeholder:text-[var(--text-muted)]",
                "hover:border-[#3a3a3a]",
                "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Host"
              placeholder="localhost"
              value={form.host}
              onChange={(e) => updateField("host", e.target.value)}
            />
            <Input
              label="Port"
              placeholder="5432"
              value={form.port}
              onChange={(e) => updateField("port", e.target.value)}
            />
            <div className="col-span-2">
              <Input
                label="Database"
                placeholder="my_database"
                value={form.database}
                onChange={(e) => updateField("database", e.target.value)}
              />
            </div>
            <Input
              label="Username"
              placeholder="postgres"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="********"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
            />
          </div>
        )}

        {/* SSL Toggle */}
        <Toggle
          checked={form.ssl}
          onChange={(checked) => updateField("ssl", checked)}
          label="Enable SSL"
        />

        {/* Test Connection */}
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            loading={testing}
            disabled={!isValid}
          >
            Test Connection
          </Button>
          {testResult && (
            <span
              className={cn(
                "text-sm",
                testResult.success ? "text-green-500" : "text-red-500"
              )}
            >
              {testResult.message}
            </span>
          )}
        </div>

        {/* Settings Section */}
        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
            <ChevronRight className="w-4 h-4" />
            Settings
          </div>
          <div className="space-y-3 pl-6">
            <Toggle
              checked={form.instantCommit}
              onChange={(checked) => updateField("instantCommit", checked)}
              label="Instant Commit (apply changes immediately)"
            />
            <Toggle
              checked={form.readOnly}
              onChange={(checked) => updateField("readOnly", checked)}
              label="Read-only Mode (prevent modifications)"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
          <Button variant="ghost" onClick={closeProjectModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!isValid}
          >
            {isEditing ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
