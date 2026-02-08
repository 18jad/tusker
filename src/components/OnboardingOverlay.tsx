import { useState, useEffect, useCallback, useRef } from "react";
import {
  Database,
  FolderOpen,
  Code,
  Table2,
  Keyboard,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
} from "lucide-react";
import { cn, modKey } from "../lib/utils";
import { useOnboardingStore } from "../stores";

interface Step {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  features?: { text: string; icon: React.ElementType }[];
}

const STEPS: Step[] = [
  {
    icon: Database,
    title: "Welcome to Tusker",
    subtitle:
      "A modern PostgreSQL client built for developers.\nLet's take a quick tour of what you can do.",
  },
  {
    icon: FolderOpen,
    title: "Project Management",
    subtitle: "Organize your database connections into projects.",
    features: [
      { text: "Manage multiple connections at once", icon: Check },
      { text: `Quick switch between projects with ${modKey}P`, icon: Check },
      { text: "Credentials stored securely in your system keychain", icon: Check },
    ],
  },
  {
    icon: Code,
    title: "Query Editor",
    subtitle: "Write and execute SQL with a powerful editor.",
    features: [
      { text: "Syntax highlighting and auto-completion", icon: Check },
      { text: `Execute queries with ${modKey}Enter`, icon: Check },
      { text: `Format and save your queries with ${modKey}S`, icon: Check },
    ],
  },
  {
    icon: Table2,
    title: "Table Browser",
    subtitle: "Explore and manage your data visually.",
    features: [
      { text: "Inline editing of rows and cells", icon: Check },
      { text: "Sort, filter, and search your data", icon: Check },
      { text: "Import and export tables with ease", icon: Check },
    ],
  },
  {
    icon: Keyboard,
    title: "Keyboard-First",
    subtitle: "Navigate everything without leaving the keyboard.",
    features: [
      { text: `Command palette with ${modKey}K`, icon: Check },
      { text: `Tab management with ${modKey}W`, icon: Check },
      { text: `View all shortcuts with ${modKey}/`, icon: Check },
    ],
  },
  {
    icon: Rocket,
    title: "You're All Set!",
    subtitle: "You're ready to start exploring your databases.",
  },
];

export function OnboardingPage() {
  const { completeOnboarding } = useOnboardingStore();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;

  const handleExit = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  const goNext = useCallback(() => {
    if (isTransitioning) return;
    if (isLastStep) {
      handleExit();
      return;
    }
    setDirection(1);
    setIsTransitioning(true);
    // Small delay so React picks up the direction before we change step
    requestAnimationFrame(() => {
      setStep((s) => s + 1);
      setTimeout(() => setIsTransitioning(false), 250);
    });
  }, [isLastStep, handleExit, isTransitioning]);

  const goBack = useCallback(() => {
    if (isTransitioning || isFirstStep) return;
    setDirection(-1);
    setIsTransitioning(true);
    requestAnimationFrame(() => {
      setStep((s) => s - 1);
      setTimeout(() => setIsTransitioning(false), 250);
    });
  }, [isFirstStep, isTransitioning]);

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
  const Icon = current.icon;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Titlebar with drag region */}
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

        {/* Skip in titlebar area */}
        {!isLastStep && (
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
            Skip tour
          </button>
        )}
      </header>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden relative">
        {/* Decorative subtle radial glow behind the icon */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[var(--accent)]/[0.03] blur-3xl pointer-events-none" />

        {/* Step content — keyed so it remounts with animation on each step */}
        <div
          ref={containerRef}
          key={step}
          className={cn(
            "w-full max-w-sm px-6 flex flex-col items-center",
            direction === 1
              ? "onboarding-slide-in-right"
              : "onboarding-slide-in-left"
          )}
        >
          {/* Icon */}
          <div className="relative mb-10">
            <div
              className={cn(
                "w-[72px] h-[72px] rounded-2xl flex items-center justify-center",
                "bg-[var(--accent)]/10 border border-[var(--accent)]/20"
              )}
            >
              <Icon className="w-9 h-9 text-[var(--accent)]" />
            </div>
            {isLastStep && (
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-4 h-4 text-[var(--warning)]" />
              </div>
            )}
          </div>

          {/* Step label */}
          {!isFirstStep && !isLastStep && (
            <div className="mb-4">
              <span className="text-[11px] font-medium uppercase tracking-widest text-[var(--accent)]">
                Step {step} of {STEPS.length - 2}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3 text-center">
            {current.title}
          </h1>

          {/* Subtitle */}
          <p className="text-[13px] text-[var(--text-secondary)] text-center leading-relaxed whitespace-pre-line max-w-xs">
            {current.subtitle}
          </p>

          {/* Feature list */}
          {current.features && (
            <div className="mt-8 w-full space-y-2">
              {current.features.map((feature, i) => {
                const FeatureIcon = feature.icon;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg",
                      "bg-[var(--bg-secondary)]/60"
                    )}
                    style={{ animationDelay: `${(i + 1) * 60}ms` }}
                  >
                    <div className="w-5 h-5 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                      <FeatureIcon className="w-3 h-3 text-[var(--accent)]" />
                    </div>
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      {feature.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Get Started CTA on last step */}
          {isLastStep && (
            <button
              onClick={handleExit}
              className={cn(
                "mt-10 flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium",
                "bg-[var(--accent)] hover:bg-[var(--accent-hover)]",
                "text-white",
                "transition-colors"
              )}
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bottom bar: dots + nav */}
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
          {/* Back button */}
          <button
            onClick={goBack}
            disabled={isFirstStep}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center",
              "border border-[var(--border-color)]",
              "transition-all",
              isFirstStep
                ? "opacity-0 pointer-events-none"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === step
                    ? "w-6 h-2 bg-[var(--accent)]"
                    : i < step
                      ? "w-2 h-2 bg-[var(--accent)]/40"
                      : "w-2 h-2 bg-[var(--text-muted)]/20"
                )}
              />
            ))}
          </div>

          {/* Next button */}
          {!isLastStep && (
            <button
              onClick={goNext}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center",
                "bg-[var(--accent)] hover:bg-[var(--accent-hover)]",
                "text-white",
                "transition-colors"
              )}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {isLastStep && (
            <div className="w-9 h-9" />
          )}
        </div>
      </div>
    </div>
  );
}
