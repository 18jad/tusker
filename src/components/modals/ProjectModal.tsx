import { useState, useEffect, useRef, useMemo } from "react";
import { Plug, Database, Check, X, Loader2, Eye, EyeOff } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useChangesStore } from "../../stores/changesStore";
import { useTestConnection, savePassword, getPassword } from "../../hooks/useDatabase";
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

// ── Themed form components ──────────────────────────────────────────

function ThemedInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 px-3 rounded-[4px] text-xs font-mono",
            "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
            "border border-[var(--border-color)]",
            "placeholder:text-[var(--text-muted)]",
            "transition-colors duration-150",
            "hover:border-[#3a3a3a]",
            "focus:outline-none focus:border-[var(--success)]/60 focus:ring-1 focus:ring-[var(--success)]/30",
            isPassword && "pr-10"
          )}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ThemedToggle({
  checked,
  onChange,
  label,
  disabled,
  tooltip,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-3" title={tooltip}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full items-center",
          "transition-colors duration-200",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "cursor-pointer",
          checked
            ? "bg-[var(--success)]"
            : "bg-[var(--bg-tertiary)] border border-[var(--border-color)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute h-3.5 w-3.5 rounded-full",
            "bg-white shadow-sm",
            "transition-all duration-200",
            checked ? "left-[18px]" : "left-[3px]"
          )}
        />
      </button>
      <span className={cn(
        "text-xs font-mono text-[var(--text-secondary)]",
        disabled && "opacity-40"
      )}>
        {label}
      </span>
    </div>
  );
}

// ── Main modal ──────────────────────────────────────────────────────

export function ProjectModal() {
  const { projectModalOpen, editingProjectId, closeProjectModal } =
    useUIStore();
  const { projects, addProject, updateProject, connections } = useProjectStore();
  const changes = useChangesStore((state) => state.changes);

  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    };
    if (colorPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [colorPickerOpen]);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const editingProject = editingProjectId
    ? projects.find((p) => p.id === editingProjectId)
    : null;
  const isEditing = !!editingProject;

  // Check if this project has uncommitted staged changes
  const hasStagedChanges = useMemo(() => {
    if (!editingProjectId) return false;
    const conn = connections[editingProjectId];
    if (!conn) return false;
    return changes.some((c) => c.connectionId === conn.connectionId);
  }, [editingProjectId, connections, changes]);

  useEffect(() => {
    if (projectModalOpen) {
      if (editingProject) {
        const conn = editingProject.connection;
        getPassword(editingProject.id)
          .then((savedPassword) => {
            setForm({
              name: editingProject.name,
              color: editingProject.color,
              connectionMethod: "manual",
              connectionString: buildConnectionString({ ...conn, password: savedPassword }),
              host: conn.host,
              port: String(conn.port),
              database: conn.database,
              username: conn.username,
              password: savedPassword,
              ssl: conn.ssl,
              instantCommit: editingProject.settings.instantCommit,
              readOnly: editingProject.settings.readOnly,
            });
          })
          .catch(() => {
            setForm({
              name: editingProject.name,
              color: editingProject.color,
              connectionMethod: "manual",
              connectionString: buildConnectionString(conn),
              host: conn.host,
              port: String(conn.port),
              database: conn.database,
              username: conn.username,
              password: "",
              ssl: conn.ssl,
              instantCommit: editingProject.settings.instantCommit,
              readOnly: editingProject.settings.readOnly,
            });
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
        message: err instanceof Error ? err.message : "Failed to connect",
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
      const password = connection.password;

      const connectionWithoutPassword = { ...connection, password: "" };

      const projectData: Omit<Project, "id" | "createdAt"> = {
        name: form.name.trim(),
        color: form.color,
        connection: connectionWithoutPassword,
        settings: {
          instantCommit: form.instantCommit,
          readOnly: form.readOnly,
        },
      };

      let projectId: string;

      if (isEditing && editingProjectId) {
        updateProject(editingProjectId, projectData);
        projectId = editingProjectId;
      } else {
        projectId = generateId();
        const newProject: Project = {
          ...projectData,
          id: projectId,
          createdAt: new Date().toISOString(),
        };
        addProject(newProject);
      }

      if (password) {
        await savePassword(projectId, password);
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
      showCloseButton={false}
      className="max-w-md !rounded-[4px]"
    >
      {/* Custom header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold font-heading tracking-[-0.3px] text-[var(--text-primary)]">
          {isEditing ? "Edit Connection" : "New Connection"}
        </h2>
        <button
          onClick={closeProjectModal}
          className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Project Name with Color Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
            PROJECT_NAME
          </label>
          <div
            ref={colorPickerRef}
            className={cn(
              "relative flex items-center rounded-[4px]",
              "bg-[var(--bg-tertiary)] border border-[var(--border-color)]",
              "focus-within:border-[var(--success)]/60 focus-within:ring-1 focus-within:ring-[var(--success)]/30",
              "hover:border-[#3a3a3a]"
            )}
          >
            <button
              type="button"
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              className="pl-3 pr-2 py-2 flex items-center justify-center"
            >
              <span className={cn(
                "w-3.5 h-3.5 rounded-full transition-transform duration-150 hover:scale-110",
                PROJECT_COLORS[form.color].dot
              )} />
            </button>
            {colorPickerOpen && (
              <div className={cn(
                "absolute left-0 top-full mt-2 p-3 rounded-[4px] z-[100]",
                "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
                "shadow-xl shadow-black/40"
              )}>
                <div className="flex gap-2.5">
                  {PROJECT_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        updateField("color", color);
                        setColorPickerOpen(false);
                      }}
                      className={cn(
                        "w-5 h-5 rounded-full transition-all duration-150 flex items-center justify-center",
                        "hover:scale-125",
                        PROJECT_COLORS[color].dot,
                        form.color === color
                          ? "ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white/50 scale-110"
                          : "opacity-60 hover:opacity-100"
                      )}
                    >
                      {form.color === color && (
                        <Check className="w-2.5 h-2.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="w-px h-5 bg-[var(--border-color)]" />
            <input
              type="text"
              placeholder="my_database"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className={cn(
                "flex-1 px-3 py-2 bg-transparent text-xs font-mono rounded-r-[4px]",
                "text-[var(--text-primary)]",
                "placeholder:text-[var(--text-muted)]",
                "focus:outline-none"
              )}
            />
          </div>
        </div>

        {/* Connection Method Toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
            CONNECTION
          </label>
          <div className="flex rounded-[4px] border border-[var(--border-color)] p-0.5 bg-[var(--bg-tertiary)]">
            <button
              type="button"
              onClick={() => updateField("connectionMethod", "manual")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[3px] text-[11px] font-medium font-mono transition-colors",
                form.connectionMethod === "manual"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Database className="w-3.5 h-3.5" />
              MANUAL
            </button>
            <button
              type="button"
              onClick={() => updateField("connectionMethod", "string")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[3px] text-[11px] font-medium font-mono transition-colors",
                form.connectionMethod === "string"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Plug className="w-3.5 h-3.5" />
              URI_STRING
            </button>
          </div>
        </div>

        {/* Connection Fields */}
        {form.connectionMethod === "string" ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
              CONNECTION_STRING
            </label>
            <textarea
              value={form.connectionString}
              onChange={(e) => handleConnectionStringChange(e.target.value)}
              placeholder="postgresql://user:password@localhost:5432/database"
              rows={2}
              className={cn(
                "w-full px-3 py-2 rounded-[4px] text-xs font-mono resize-none",
                "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
                "border border-[var(--border-color)]",
                "placeholder:text-[var(--text-muted)]",
                "hover:border-[#3a3a3a]",
                "focus:outline-none focus:border-[var(--success)]/60 focus:ring-1 focus:ring-[var(--success)]/30"
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <ThemedInput
                label="HOST"
                placeholder="localhost"
                value={form.host}
                onChange={(e) => updateField("host", e.target.value)}
              />
            </div>
            <ThemedInput
              label="PORT"
              placeholder="5432"
              value={form.port}
              onChange={(e) => updateField("port", e.target.value)}
            />
            <div className="col-span-4">
              <ThemedInput
                label="DATABASE"
                placeholder="my_database"
                value={form.database}
                onChange={(e) => updateField("database", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <ThemedInput
                label="USERNAME"
                placeholder="postgres"
                value={form.username}
                onChange={(e) => updateField("username", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <ThemedInput
                label="PASSWORD"
                type="password"
                placeholder="********"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* SSL + Options */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
            OPTIONS
          </label>
          <div className="flex flex-col gap-2.5">
            <ThemedToggle
              checked={form.ssl}
              onChange={(checked) => updateField("ssl", checked)}
              label="USE_SSL"
            />
            <div className="h-px bg-[var(--border-color)]" />
            <ThemedToggle
              checked={form.instantCommit}
              onChange={(checked) => updateField("instantCommit", checked)}
              label="INSTANT_COMMIT"
              disabled={!form.instantCommit && hasStagedChanges}
              tooltip={!form.instantCommit && hasStagedChanges ? "Commit or discard staged changes before enabling instant commit" : undefined}
            />
            <ThemedToggle
              checked={form.readOnly}
              onChange={(checked) => updateField("readOnly", checked)}
              label="READ_ONLY"
            />
          </div>
        </div>

        {/* Test result message */}
        {testResult && (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-[4px] text-[11px] font-mono",
              testResult.success
                ? "bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20"
                : "bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20"
            )}
          >
            {testResult.success ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Plug className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{testResult.message}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-color)]">
          <button
            onClick={handleTestConnection}
            disabled={!isValid || testing}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[11px] font-medium font-mono",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]",
              "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
              "transition-colors duration-150",
              (!isValid || testing) && "opacity-50 cursor-not-allowed"
            )}
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plug className="w-3.5 h-3.5" />
            )}
            {testing ? "TESTING..." : "TEST"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={closeProjectModal}
              className={cn(
                "px-3 py-1.5 rounded-[4px] text-[11px] font-medium font-mono",
                "text-[var(--text-secondary)]",
                "hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                "transition-colors duration-150"
              )}
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-[11px] font-semibold font-mono",
                "bg-[var(--success)] text-[var(--bg-primary)]",
                "hover:bg-[var(--success)]/90",
                "transition-colors duration-150",
                (!isValid || saving) && "opacity-50 cursor-not-allowed"
              )}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? "SAVE" : "CREATE"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
