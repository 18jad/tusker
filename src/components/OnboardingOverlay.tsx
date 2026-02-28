import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code,
  Database,
  Eye,
  EyeOff,
  GitBranch,
  Hammer,
  Loader2,
  Lock,
  Search,
  Table2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import appIcon from "../assets/app-icon.png";
import imgQueryEditor from "../assets/onboarding-query-editor.png";
import imgStagedChanges from "../assets/onboarding-staged-changes.png";
import imgTableBrowser from "../assets/onboarding-table-browser.png";
import imgTableBuilder from "../assets/onboarding-table-builder.png";
import { cn } from "../lib/utils";
import { useOnboardingStore } from "../stores";
import { useProjectStore } from "../stores/projectStore";
import type { ProjectColor } from "../types";

interface FeatureStep {
  type: "feature";
  icon: React.ElementType;
  tag: string;
  title: string;
  description: string;
  image: string;
}

interface BookendStep {
  type: "welcome" | "discover";
}

type Step = FeatureStep | BookendStep;

const STEPS: Step[] = [
  { type: "welcome" },
  {
    type: "feature",
    icon: Table2,
    tag: "Browse",
    title: "Table Browser",
    description:
      "Explore your data visually with inline editing, multi-column sorting, and full CRUD operations.",
    image: imgTableBrowser
  },
  {
    type: "feature",
    icon: Code,
    tag: "Query",
    title: "Query Editor",
    description:
      "Write SQL with syntax highlighting, auto-completion, and instant execution.",
    image: imgQueryEditor
  },
  {
    type: "feature",
    icon: GitBranch,
    tag: "Changes",
    title: "Staged Changes",
    description:
      "Review every edit before it hits your database with git-style diffs and commit history.",
    image: imgStagedChanges
  },
  {
    type: "feature",
    icon: Hammer,
    tag: "Build",
    title: "Table Builder",
    description:
      "Design tables visually with columns, constraints, indexes, and foreign keys.",
    image: imgTableBuilder
  },
  { type: "discover" }
];

export function OnboardingPage() {
  const { completeOnboarding } = useOnboardingStore();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(true);

  const total = STEPS.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  const handleExit = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  const transition = useCallback(
    (next: number) => {
      if (animating) return;
      setAnimating(true);
      setVisible(false);

      setTimeout(() => {
        setStep(next);
        setVisible(true);
        setTimeout(() => setAnimating(false), 350);
      }, 200);
    },
    [animating]
  );

  const goNext = useCallback(() => {
    if (isLast) {
      handleExit();
      return;
    }
    transition(step + 1);
  }, [isLast, handleExit, transition, step]);

  const goBack = useCallback(() => {
    if (isFirst) return;
    transition(step - 1);
  }, [isFirst, transition, step]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleExit();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExit, goNext, goBack]);

  const current = STEPS[step];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)] relative">
      {/* Dot pattern overlay — fades from top to bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 4px, transparent 4px)",
          backgroundSize: "32px 32px",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)",
        }}
      />
      {/* Titlebar */}
      <header
        className={cn(
          "h-10 flex items-center shrink-0 relative",
          "bg-[var(--bg-secondary)] border-b border-[var(--border-color)]",
          "select-none"
        )}
        data-tauri-drag-region
      >
        <div className="w-[78px] shrink-0" data-tauri-drag-region />
        <div className="flex-1" data-tauri-drag-region />
        <div
          className="absolute left-1/2 -translate-x-1/2 text-sm text-[var(--text-muted)] pointer-events-none"
          data-tauri-drag-region
        >
          Tusker
        </div>
        <button
          onClick={handleExit}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2",
            "px-2.5 py-1 rounded-md text-xs",
            "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            "hover:bg-[var(--bg-tertiary)]",
            "transition-colors"
          )}
        >
          Skip
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[var(--accent)]/[0.03] blur-[100px] pointer-events-none" />

        {/* Step content with crossfade */}
        <div
          className={cn(
            "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )}
        >
          {current.type === "welcome" && <WelcomeStep />}
          {current.type === "feature" && <FeatureSlide step={current} />}
          {current.type === "discover" && <DiscoverStep onComplete={handleExit} />}
        </div>

        {/* Bottom navigation */}
        <div className="shrink-0 py-4 flex items-center justify-center gap-6">
          {/* Back */}
          <button
            onClick={goBack}
            disabled={isFirst}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "border border-[var(--border-color)]",
              "transition-all duration-200",
              isFirst
                ? "opacity-0 pointer-events-none"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (i !== step && !animating) transition(i);
                }}
                className={cn(
                  "rounded-full transition-all duration-300 ease-out",
                  i === step
                    ? "w-6 h-1.5 bg-[var(--accent)]"
                    : i < step
                      ? "w-1.5 h-1.5 bg-[var(--accent)]/40 hover:bg-[var(--accent)]/60 cursor-pointer"
                      : "w-1.5 h-1.5 bg-[var(--text-muted)]/20 hover:bg-[var(--text-muted)]/40 cursor-pointer"
                )}
              />
            ))}
          </div>

          {/* Next */}
          {!isLast ? (
            <button
              onClick={goNext}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                "bg-[var(--accent)] hover:bg-[var(--accent-hover)]",
                "text-white transition-colors duration-200"
              )}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="relative mb-8">
        <div className="w-40 h-40 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center shadow-lg shadow-black/20">
          <img
            src={appIcon}
            alt="Tusker"
            className="w-full h-full scale-110"
            draggable={false}
          />
        </div>
        <div className="absolute inset-0 -m-2 rounded-2xl border border-[var(--accent)]/10 pointer-events-none" />
      </div>

      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
        Welcome to Tusker
      </h1>
      <p className="text-xl text-[var(--text-secondary)] leading-relaxed mb-1">
        A modern PostgreSQL client built for developers.
      </p>
      <p className="text-base text-[var(--text-muted)]">
        Let's take a quick look at what you can do.
      </p>
    </div>
  );
}

function FeatureSlide({ step }: { step: FeatureStep }) {
  const Icon = step.icon;

  return (
    <div className="flex-1 flex items-center overflow-hidden">
      {/* Left — feature text */}
      <div className="w-[400px] shrink-0 pl-14 pr-6 flex flex-col justify-center">
        {/* Icon + tag */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
            <Icon className="w-[18px] h-[18px] text-[var(--accent)]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
            {step.tag}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-[28px] font-bold text-[var(--text-primary)] leading-tight mb-3">
          {step.title}
        </h2>

        {/* Description */}
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Right — floating screenshot with perspective */}
      <div
        className="flex-1 min-w-0 h-full relative flex items-center"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative ml-4 -mr-24"
          style={{
            transform: "rotateY(-6deg) rotateX(2deg)",
            transformOrigin: "center center"
          }}
        >
          {/* Screenshot */}
          <img
            src={step.image}
            alt={step.title}
            className="w-full h-auto block rounded-2xl"
            draggable={false}
          />
        </div>

        {/* Right edge fade so the overflow feels intentional */}
        <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-[var(--bg-primary)] to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}

interface DiscoveredDatabase {
  host: string;
  port: number;
  username: string;
  database_name: string;
  auth_status: "trust" | "password_required";
  already_imported: boolean;
}

const COLOR_CYCLE: ProjectColor[] = ["blue", "green", "yellow", "orange", "red", "purple"];

function DiscoverStep({ onComplete }: { onComplete: () => void }) {
  const { addProject } = useProjectStore();

  const [phase, setPhase] = useState<"scanning" | "results" | "importing">("scanning");
  const [databases, setDatabases] = useState<DiscoveredDatabase[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const colorIndexRef = useRef(0);
  const hasScanned = useRef(false);

  const dbKey = (db: DiscoveredDatabase) =>
    `${db.host}:${db.port}/${db.database_name}`;

  const serverKey = (db: DiscoveredDatabase) =>
    `${db.host}:${db.port}`;

  // Auto-scan on mount
  useEffect(() => {
    if (hasScanned.current) return;
    hasScanned.current = true;

    (async () => {
      try {
        const results = await invoke<DiscoveredDatabase[]>(
          "discover_local_databases",
          { existing: [] }
        );
        setDatabases(results);
        const autoSelected = new Set<string>();
        for (const db of results) {
          autoSelected.add(dbKey(db));
        }
        setSelected(autoSelected);
      } catch (err) {
        console.error("Discovery error:", err);
        setError(typeof err === "string" ? err : "Failed to scan for local databases.");
      } finally {
        setPhase("results");
      }
    })();
  }, []);

  const toggleSelection = (db: DiscoveredDatabase) => {
    const key = dbKey(db);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectableCount = databases.length;
  const allSelected = selectableCount > 0 && selected.size === selectableCount;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(databases.map(dbKey)));
    }
  };

  // Group by server
  const serverGroups = databases.reduce<Record<string, DiscoveredDatabase[]>>(
    (acc, db) => {
      const key = serverKey(db);
      if (!acc[key]) acc[key] = [];
      acc[key].push(db);
      return acc;
    },
    {}
  );

  // Which servers need passwords
  const needPasswordServers = new Set<string>();
  for (const db of databases) {
    if (selected.has(dbKey(db)) && db.auth_status === "password_required") {
      needPasswordServers.add(serverKey(db));
    }
  }

  const canImport =
    selected.size > 0 &&
    Array.from(needPasswordServers).every(
      (sk) => passwords[sk] && passwords[sk].length > 0
    );

  const handleImport = async () => {
    setError(null);
    setPasswordErrors({});

    const selectedDbs = databases.filter((db) => selected.has(dbKey(db)));
    if (selectedDbs.length === 0) return;

    // Verify passwords
    for (const sKey of needPasswordServers) {
      const pw = passwords[sKey] || "";
      if (!pw) {
        setPasswordErrors((prev) => ({ ...prev, [sKey]: "Password is required" }));
        return;
      }
      const testDb = selectedDbs.find(
        (db) => serverKey(db) === sKey && db.auth_status === "password_required"
      );
      if (testDb) {
        try {
          await invoke("test_connection", {
            request: {
              host: testDb.host,
              port: testDb.port,
              database: testDb.database_name,
              username: testDb.username,
              password: pw,
              ssl_mode: null,
            },
          });
        } catch {
          setPasswordErrors((prev) => ({
            ...prev,
            [sKey]: "Authentication failed. Check your password.",
          }));
          return;
        }
      }
    }

    // Import
    setPhase("importing");

    try {
      const existingNames = new Set<string>();

      for (const db of selectedDbs) {
        const projectId = crypto.randomUUID();
        let name = db.database_name;
        if (existingNames.has(name)) {
          let suffix = 1;
          while (existingNames.has(`${name} (${suffix})`)) suffix++;
          name = `${db.database_name} (${suffix})`;
        }
        existingNames.add(name);

        const color = COLOR_CYCLE[colorIndexRef.current % COLOR_CYCLE.length];
        colorIndexRef.current++;

        const sKey = serverKey(db);
        const pw = db.auth_status === "password_required" ? passwords[sKey] || "" : "";

        addProject({
          id: projectId,
          name,
          color,
          connection: {
            host: db.host,
            port: db.port,
            database: db.database_name,
            username: db.username,
            password: "",
            ssl: false,
          },
          settings: { instantCommit: true, readOnly: false },
          createdAt: new Date().toISOString(),
        });

        if (pw) {
          try {
            await invoke("save_password", { projectId, password: pw });
          } catch (err) {
            console.error("Failed to save password:", err);
          }
        }
      }

      onComplete();
    } catch (err) {
      console.error("Import error:", err);
      setError(typeof err === "string" ? err : "Failed to import databases.");
      setPhase("results");
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      {/* Header */}
      <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-5">
        <Search className="w-6 h-6 text-[var(--accent)]" />
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
        {phase === "scanning"
          ? "Scanning for databases..."
          : databases.length > 0
            ? "Local databases found"
            : "No local databases found"}
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {phase === "scanning"
          ? "Looking for PostgreSQL databases on your machine."
          : databases.length > 0
            ? "Select the ones you'd like to import into Tusker."
            : "You can always add databases manually from the dashboard."}
      </p>

      {/* Scanning */}
      {phase === "scanning" && (
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      )}

      {/* Importing */}
      {phase === "importing" && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
          <span className="text-sm text-[var(--text-muted)]">Importing...</span>
        </div>
      )}

      {/* Results */}
      {phase === "results" && (
        <div className="w-full max-w-sm">
          {error && (
            <div className="mb-3 px-3 py-2.5 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {databases.length > 0 && (
            <>
              {/* Select all */}
              {selectableCount > 1 && (
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">
                    {selected.size} of {selectableCount} selected
                  </span>
                </div>
              )}

              {/* Database list */}
              <div className="max-h-48 overflow-y-auto space-y-3 mb-5">
                {Object.entries(serverGroups).map(([sKey, dbs]) => (
                  <div key={sKey}>
                    <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                      <Database className="w-3 h-3" />
                      localhost:{dbs[0].port}
                    </div>
                    <div className="space-y-1">
                      {dbs.map((db) => {
                        const key = dbKey(db);
                        const isSelected = selected.has(key);
                        return (
                          <button
                            key={key}
                            onClick={() => toggleSelection(db)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-left transition-colors",
                              isSelected
                                ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20"
                                : "bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--text-muted)]"
                            )}
                          >
                            <div
                              className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-[var(--accent)] border-[var(--accent)]"
                                  : "border-[var(--border-color)]"
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">
                              {db.database_name}
                            </span>
                            {db.auth_status === "trust" ? (
                              <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                                No password
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                <Lock className="w-2.5 h-2.5" />
                                Password
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Password input */}
                    {needPasswordServers.has(sKey) && (
                      <div className="mt-2 ml-7">
                        <div className="relative">
                          <input
                            type={showPasswords[sKey] ? "text" : "password"}
                            value={passwords[sKey] || ""}
                            onChange={(e) => {
                              setPasswords((prev) => ({ ...prev, [sKey]: e.target.value }));
                              setPasswordErrors((prev) => {
                                const next = { ...prev };
                                delete next[sKey];
                                return next;
                              });
                            }}
                            placeholder="Enter password"
                            className={cn(
                              "w-full h-8 px-3 pr-9 rounded-[4px] text-sm",
                              "bg-[var(--bg-primary)] border",
                              passwordErrors[sKey] ? "border-red-500/50" : "border-[var(--border-color)]",
                              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                              "focus:outline-none focus:border-[var(--accent)]",
                              "transition-colors"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords((prev) => ({ ...prev, [sKey]: !prev[sKey] }))
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                          >
                            {showPasswords[sKey] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {passwordErrors[sKey] && (
                          <p className="mt-1 text-xs text-red-400">{passwordErrors[sKey]}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Import button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onComplete}
                  className={cn(
                    "flex-1 h-10 px-4 rounded-xl text-sm font-medium",
                    "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
                    "hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                    "border border-[var(--border-color)]",
                    "transition-colors"
                  )}
                >
                  Skip
                </button>
                <button
                  onClick={handleImport}
                  disabled={!canImport}
                  className={cn(
                    "flex-1 h-10 px-4 rounded-xl text-sm font-semibold",
                    "flex items-center justify-center gap-2",
                    "bg-[var(--accent)] hover:bg-[var(--accent-hover)]",
                    "text-white",
                    "transition-all duration-200 disabled:opacity-50",
                    "hover:-translate-y-0.5"
                  )}
                >
                  Import & Start
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Empty state */}
          {databases.length === 0 && !error && (
            <div className="text-center">
              <button
                onClick={onComplete}
                className={cn(
                  "flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-base font-semibold mx-auto",
                  "bg-[var(--accent)] hover:bg-[var(--accent-hover)]",
                  "text-white",
                  "transition-all duration-200",
                  "hover:-translate-y-0.5"
                )}
              >
                Get Started
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
