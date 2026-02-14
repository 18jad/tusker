import {
  ArrowLeft,
  ArrowRight,
  Code,
  GitBranch,
  Hammer,
  Table2
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import appIcon from "../assets/app-icon.png";
import imgQueryEditor from "../assets/onboarding-query-editor.png";
import imgStagedChanges from "../assets/onboarding-staged-changes.png";
import imgTableBrowser from "../assets/onboarding-table-browser.png";
import imgTableBuilder from "../assets/onboarding-table-builder.png";
import { cn } from "../lib/utils";
import { useOnboardingStore } from "../stores";

interface FeatureStep {
  type: "feature";
  icon: React.ElementType;
  tag: string;
  title: string;
  description: string;
  image: string;
}

interface BookendStep {
  type: "welcome" | "ready";
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
  { type: "ready" }
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
        {!isLast && (
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
        )}
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
          {current.type === "ready" && <ReadyStep onStart={handleExit} />}
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

function ReadyStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <img src={appIcon} alt="Tusker" className="w-24 h-24 mb-8" draggable={false} />

      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
        You're ready to go
      </h1>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-10">
        Create your first project and start exploring.
      </p>

      <button
        onClick={onStart}
        className={cn(
          "flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-base font-semibold",
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
  );
}
