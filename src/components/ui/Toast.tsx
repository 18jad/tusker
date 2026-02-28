import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { cn } from "../../lib/utils";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const styles = {
  success: {
    bg: "bg-green-500/10 border-green-500/20",
    icon: "text-green-500",
    text: "text-green-400",
  },
  error: {
    bg: "bg-red-500/10 border-red-500/20",
    icon: "text-red-500",
    text: "text-red-400",
  },
  info: {
    bg: "bg-[var(--accent)]/10 border-[var(--accent)]/20",
    icon: "text-[var(--accent)]",
    text: "text-[var(--accent)]",
  },
};

export function Toast() {
  const toasts = useUIStore((state) => state.toasts);
  const dismissToast = useUIStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        const style = styles[toast.type];

        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-[4px] border",
              "shadow-lg backdrop-blur-sm",
              "animate-in slide-in-from-right-5 fade-in duration-200",
              style.bg
            )}
          >
            <Icon className={cn("w-5 h-5 shrink-0", style.icon)} />
            <span className={cn("text-sm font-medium", style.text)}>
              {toast.message}
            </span>
            <button
              onClick={() => dismissToast(toast.id)}
              className={cn(
                "ml-2 p-1 rounded hover:bg-white/10 transition-colors",
                style.text
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
