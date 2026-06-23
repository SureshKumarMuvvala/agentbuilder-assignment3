// Small shared UI helpers: map the backend's CLI colour names to hex, and a
// status -> colour helper so the graph, timeline, and tool trace stay consistent.

import type { NodeStatus } from "../hooks/useGraphRun";

// The backend reuses the CLI's NODE_META colour names (magenta/yellow/…). Keep
// this map in sync with tailwind.config.js so a concept reads the same colour
// everywhere — terminal, graph, and panels.
export const COLOR_HEX: Record<string, string> = {
  magenta: "#c084fc",
  yellow: "#fde047",
  blue: "#60a5fa",
  cyan: "#22d3ee",
  green: "#4ade80",
  white: "#94a3b8",
  red: "#f87171",
};

export function colorHex(name: string): string {
  return COLOR_HEX[name] ?? COLOR_HEX.white;
}

// Border/glow colour for a node given its live execution status.
export function statusColor(status: NodeStatus, base: string): string {
  if (status === "error") return COLOR_HEX.red;
  if (status === "running") return COLOR_HEX.yellow;
  if (status === "done") return colorHex(base);
  return "#334155"; // idle
}

// A compact JSON renderer for slim dicts (tool outputs, state deltas).
export function pretty(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
