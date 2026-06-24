// turnResult.ts — the complete research artifact for one conversation turn.
//
// THE PROBLEM this solves: a turn used to be stored only as raw execution data
// (timeline/graph/tools/state/memory). The *business output* a founder actually
// came for — the verdict, the analysis, the rationale, the scores, the
// recommendations — was re-derived on the fly and never treated as a first-class,
// preserved result. TurnResult bundles BOTH halves so every turn is a self-
// contained, replayable artifact:
//
//   Research results : query · intent · verdict · analysis · rationale ·
//                      recommendations · scores
//   Execution details: timeline · graph · tools · state · memory
//
// buildTurnResult() assembles it deterministically from a TurnExecution, so a
// historical turn restores exactly what it produced — nothing is lost.

import type { CheckpointEntry, NodeRun, ToolRun, TurnExecution } from "../hooks/useGraphRun";
import type { GraphState } from "../types";
import {
  deriveScores,
  deriveThesis,
  normalizeIntent,
  parseVerdict,
  type Intent,
  type Scores,
  type VerdictLabel,
} from "./ui";
import { asResearch, fmtPrice, ok, priceBand, type Research } from "./research";

export interface TurnResult {
  // --- Research results (the business output) ---
  query: string;
  intent: Intent;
  verdict: VerdictLabel; // GO / NO-GO / NICHE (PENDING only mid-run or non-verdict)
  analysis: string; // one-line headline thesis
  rationale: string; // the agent's full reasoning
  recommendations: string[]; // concrete, intent-specific next steps
  scores: Scores; // demand / supply / competition / confidence
  // --- Execution details (the debug trace) ---
  timeline: NodeRun[];
  graph: Record<string, NodeRun>; // per-node status, keyed by id
  tools: ToolRun[];
  state: GraphState | null; // typed state + merged research
  memory: CheckpointEntry[]; // SqliteSaver checkpoints written this turn
}

// Turn the gathered signals into concrete recommendations, per routed intent.
function deriveRecommendations(intent: Intent, r: Research): string[] {
  const recs: string[] = [];

  if (intent === "demand") {
    const t = r.trends;
    if (ok(t)) {
      if (t.trend === "rising") recs.push("Demand is rising — validate and move while interest grows.");
      else if (t.trend === "falling") recs.push("Demand is cooling — confirm a durable niche before committing.");
      else recs.push("Demand is flat — you'll need differentiation to create pull.");
      if (t.related?.length) recs.push(`Lean into rising searches: ${t.related.slice(0, 3).join(", ")}.`);
    }
  } else if (intent === "pricing") {
    const s = ok(r.shopping) ? r.shopping : ok(r.amazon) ? r.amazon : undefined;
    const median = ok(r.shopping) && typeof r.shopping.median === "number" ? r.shopping.median : undefined;
    if (median != null) {
      recs.push(`Enter at ${fmtPrice(Math.round(median * 0.9))}–${fmtPrice(median)} to undercut the ${fmtPrice(median)} median.`);
    } else if (s) {
      recs.push(`Price within the ${priceBand(s.low, s.high)} market band.`);
    }
  } else if (intent === "reviews") {
    const rv = r.reviews;
    if (ok(rv) && rv.complaints?.length) {
      for (const c of rv.complaints.slice(0, 3)) recs.push(`Differentiate by fixing: “${c}”.`);
    }
  } else {
    // full report: a synthesis across demand + supply + gaps.
    const t = r.trends;
    const a = r.amazon;
    const rv = r.reviews;
    if (ok(t) && t.trend === "rising") recs.push("Demand is rising — timing favours entry.");
    if (ok(a) && typeof a.sellers === "number") {
      recs.push(`Field has ${a.sellers} sellers — ${a.sellers > 20 ? "differentiate sharply to stand out" : "still room to enter"}.`);
    }
    if (ok(rv) && rv.complaints?.length) recs.push(`Win on the top unmet gap: “${rv.complaints[0]}”.`);
  }

  return recs;
}

// Assemble the complete artifact from a turn's raw, append-only execution record.
// Pure + deterministic, so any historical turn rebuilds exactly what it produced.
export function buildTurnResult(turn: TurnExecution): TurnResult {
  const research = turn.finalState?.research ?? null;
  const r = asResearch(research);
  const intent = normalizeIntent(turn.routing?.intent ?? turn.finalState?.intent);
  const verdict = parseVerdict(turn.answer);

  return {
    query: turn.question,
    intent,
    verdict,
    analysis: deriveThesis(turn.answer),
    rationale: turn.answer ?? "",
    recommendations: turn.answer ? deriveRecommendations(intent, r) : [],
    scores: deriveScores(verdict, research),
    timeline: turn.timeline,
    graph: turn.nodes,
    tools: turn.tools,
    state: turn.finalState,
    memory: turn.checkpoints,
  };
}
