// research.ts — typed reader for the merged `research` dict the fan-out produces.
//
// Each fan-out branch writes one slim dict (see launchlens/tools/*). They're tiny
// and may instead carry {error} when a live call failed. This module gives the UI
// typed access + small formatters so the scoreboard and insight panels never poke
// at raw `unknown` and always degrade gracefully on missing/error data.

export interface TrendsSignal {
  trend?: "rising" | "falling" | "flat";
  avg_interest?: number;
  related?: string[];
  error?: string;
}
export interface ShoppingSignal {
  low?: number;
  median?: number;
  high?: number;
  n?: number;
  error?: string;
}
export interface NewsSignal {
  count?: number;
  recent_headlines?: string[];
  error?: string;
}
export interface AmazonSignal {
  sellers?: number;
  low?: number;
  high?: number;
  avg_rating?: number;
  top_asin?: string;
  error?: string;
}
export interface ReviewsSignal {
  reviews_seen?: number;
  avg_rating?: number;
  complaints?: string[];
  error?: string;
}

export interface Research {
  trends?: TrendsSignal;
  shopping?: ShoppingSignal;
  news?: NewsSignal;
  amazon?: AmazonSignal;
  reviews?: ReviewsSignal;
}

// Coerce the loosely-typed state dict into our Research shape.
export function asResearch(r: Record<string, unknown> | null | undefined): Research {
  return (r ?? {}) as Research;
}

// True when a branch returned usable data (present and not an {error} dict).
export function ok<T extends { error?: string }>(v: T | undefined): v is T {
  return !!v && !v.error;
}

// Does the research dict carry any signal at all? (drives whether we render.)
export function hasAnySignal(r: Research): boolean {
  return [r.trends, r.shopping, r.news, r.amazon, r.reviews].some(ok);
}

// --- Formatters ---------------------------------------------------------------
// Fixtures are US marketplaces, so we render a $ symbol; values come pre-slimmed.

export function fmtPrice(n?: number): string {
  return typeof n === "number" ? `$${Math.round(n).toLocaleString()}` : "—";
}

export function priceBand(low?: number, high?: number): string {
  if (typeof low !== "number" || typeof high !== "number") return "—";
  return `${fmtPrice(low)}–${fmtPrice(high)}`;
}
