import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProjectColor } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Platform detection for keyboard shortcuts
export const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
export const modKey = isMac ? "⌘" : "Ctrl+";
export const modKeyName = isMac ? "Cmd" : "Ctrl";

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export const PROJECT_COLORS: Record<ProjectColor, { bg: string; text: string; dot: string }> = {
  blue: { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
  green: { bg: "bg-green-500/20", text: "text-green-400", dot: "bg-green-500" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-500" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-500" },
  red: { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-500" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400", dot: "bg-purple-500" },
};

export function formatCellValue(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function parseConnectionString(connectionString: string): {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
} | null {
  try {
    // Format: postgresql://user:password@host:port/database
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
    };
  } catch {
    return null;
  }
}

export function buildConnectionString(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}): string {
  const { host, port, database, username, password, ssl } = config;
  const sslParam = ssl ? "?sslmode=require" : "";
  return `postgresql://${username}:${password}@${host}:${port}/${database}${sslParam}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
