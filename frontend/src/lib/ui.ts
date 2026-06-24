// Small shared UI helpers: map the backend's CLI colour names to hex, and a
// status -> colour helper so the graph, timeline, and tool trace stay consistent.

import type { NodeStatus } from "../hooks/useGraphRun";
import { asResearch, ok } from "./research";

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

// --- Verdict semantics --------------------------------------------------------
// The agent returns free prose that opens with GO / NO-GO / NICHE. We parse that
// leading label so the report can theme the whole hero by it (Path A — no backend
// change). Order matters: check "no-go"/"no go" before "go".

export type VerdictLabel = "GO" | "NO-GO" | "NICHE" | "PENDING";

export interface VerdictTheme {
  label: VerdictLabel;
  color: string; // accent / text
  bg: string; // tinted fill
  ring: string; // border
}

const VERDICT_THEMES: Record<VerdictLabel, VerdictTheme> = {
  GO: { label: "GO", color: "#34d399", bg: "rgba(52,211,153,0.10)", ring: "rgba(52,211,153,0.35)" },
  "NO-GO": { label: "NO-GO", color: "#fb7185", bg: "rgba(251,113,133,0.10)", ring: "rgba(251,113,133,0.35)" },
  NICHE: { label: "NICHE", color: "#fbbf24", bg: "rgba(251,191,36,0.10)", ring: "rgba(251,191,36,0.35)" },
  PENDING: { label: "PENDING", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", ring: "#1e2430" },
};

// Pull the verdict label out of the agent's prose. Tolerant of "No-Go", "no go",
// "NICHE:", markdown bold, etc. Returns PENDING when nothing matches yet.
export function parseVerdict(text: string | undefined | null): VerdictLabel {
  if (!text) return "PENDING";
  const head = text.slice(0, 200).toUpperCase();
  if (/\bNO[\s-]?GO\b/.test(head)) return "NO-GO";
  if (/\bNICHE\b/.test(head)) return "NICHE";
  if (/\bGO\b/.test(head)) return "GO";
  return "PENDING";
}

export function verdictTheme(label: VerdictLabel): VerdictTheme {
  return VERDICT_THEMES[label];
}

// Pull a one-line thesis out of the agent's prose: drop the leading verdict token
// and keep the first sentence. This is the headline a founder reads under the
// badge, so it stays short.
export function deriveThesis(answer?: string | null): string {
  if (!answer) return "";
  const stripped = answer.trim().replace(/^\**\s*(NO[\s-]?GO|NICHE|GO)\b[\s:.\-—)]*/i, "");
  const firstSentence = stripped.match(/^.*?[.!?](\s|$)/);
  let s = (firstSentence ? firstSentence[0] : stripped).trim();
  if (s.length > 160) s = s.slice(0, 157).trimEnd() + "…";
  return s;
}

// Derive a transparent "signal strength" score (0–97%) for the verdict from the
// research dict — Path A, no backend change. It rewards EVIDENCE BREADTH (how many
// research branches returned real data) and SIGNAL CLARITY (a decisive trend, and
// review complaints that point to an actionable gap). Presented as confidence in
// the verdict; deliberately capped below 100 since it's a heuristic, not a model.
export function deriveConfidence(
  label: VerdictLabel,
  research: Record<string, unknown> | undefined | null,
): number | null {
  if (label === "PENDING") return null;
  const r = (research ?? {}) as Record<string, any>;

  let score = 55; // neutral base

  // Evidence breadth: every branch that returned usable (non-error) data.
  const branches = ["trends", "shopping", "news", "amazon", "reviews"];
  const present = branches.filter(
    (k) => r[k] && typeof r[k] === "object" && !("error" in r[k]),
  );
  score += present.length * 4; // up to +20

  // Demand clarity: a decisive trend is stronger evidence than a flat one.
  const t = r.trends;
  if (t && typeof t === "object" && !("error" in t)) {
    if (t.trend === "rising") score += 8;
    else if (t.trend === "falling") score += 4;
    if (typeof t.avg_interest === "number") score += Math.min(8, t.avg_interest / 15);
  }

  // Gap clarity: concrete review complaints = an actionable opening.
  const rv = r.reviews;
  if (rv && Array.isArray(rv.complaints) && rv.complaints.length) score += 5;

  return Math.max(0, Math.min(97, Math.round(score)));
}

// --- Routing / intent ---------------------------------------------------------
// The router (classify_intent) labels each question with one of four intents. The
// UI renders a different result card per intent, so this is the source of truth
// for "which card + which badge". The backend uses "full"; we badge it FULL_REPORT.

export type Intent = "demand" | "pricing" | "reviews" | "full";

export function normalizeIntent(intent: string | null | undefined): Intent {
  return intent === "demand" || intent === "pricing" || intent === "reviews"
    ? intent
    : "full"; // default path is the full Go/No-Go report
}

export const INTENT_BADGE: Record<Intent, { label: string; color: string }> = {
  demand: { label: "DEMAND", color: "#60a5fa" },
  pricing: { label: "PRICING", color: "#22d3ee" },
  reviews: { label: "REVIEWS", color: "#fbbf24" },
  full: { label: "FULL_REPORT", color: "#34d399" },
};

// The four headline scores for a FULL_REPORT, derived from the slim research dict
// (Path A — no backend change). All are transparent 0–100 heuristics over the
// gathered signals; null when the backing branch returned no usable data.
export interface Scores {
  demand: number | null; // market pull (trend interest + direction)
  supply: number | null; // how well-served the market already is (incumbent quality)
  competition: number | null; // how crowded the field is (seller count)
  confidence: number | null; // evidence strength behind the verdict
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function deriveScores(
  label: VerdictLabel,
  research: Record<string, unknown> | null | undefined,
): Scores {
  const r = asResearch(research);
  const t = r.trends;
  const a = r.amazon;

  // Demand: average search interest, nudged by trend direction.
  let demand: number | null = null;
  if (ok(t) && typeof t.avg_interest === "number") {
    const dir = t.trend === "rising" ? 10 : t.trend === "falling" ? -12 : 0;
    demand = clamp100(t.avg_interest + dir);
  }

  // Supply: incumbent quality — a well-rated, well-stocked field is "high supply".
  let supply: number | null = null;
  if (ok(a)) {
    if (typeof a.avg_rating === "number") supply = clamp100((a.avg_rating / 5) * 100);
    else if (typeof a.sellers === "number") supply = clamp100(a.sellers * 6);
  }

  // Competition: how crowded — seller count scaled (more sellers = tougher entry).
  let competition: number | null = null;
  if (ok(a) && typeof a.sellers === "number") competition = clamp100(a.sellers * 6);

  return { demand, supply, competition, confidence: deriveConfidence(label, research) };
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
