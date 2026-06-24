// GraphReplay — lets a grader replay a historical turn's execution on the graph.
//
// A finished turn stores every node's final status + the superstep it ran in. This
// wrapper plays those supersteps back in order: nodes light up superstep-by-
// superstep (idle → running → done), so you can re-watch the routing → fan-out →
// agent flow of ANY past turn, not just the live one. "Show full" jumps to the
// final state.

import { useEffect, useMemo, useState } from "react";
import type { GraphTopology } from "../types";
import type { NodeRun, TurnExecution } from "../hooks/useGraphRun";
import GraphView from "./GraphView";

// Build a per-node status map as it looked at superstep `step`: earlier supersteps
// show their final status, the current one shows "running", later ones are idle.
function nodesAtStep(turn: TurnExecution, step: number): Record<string, NodeRun> {
  const out: Record<string, NodeRun> = {};
  for (const [id, n] of Object.entries(turn.nodes)) {
    if (n.step == null) {
      out[id] = n; // control nodes without a superstep: leave as captured
    } else if (n.step < step) {
      out[id] = n; // already completed
    } else if (n.step === step) {
      out[id] = { ...n, status: "running" };
    } else {
      out[id] = { ...n, status: "idle" };
    }
  }
  return out;
}

export default function GraphReplay({
  turn,
  topology,
}: {
  turn: TurnExecution;
  topology: GraphTopology | null;
}) {
  // The ordered, distinct supersteps this turn executed.
  const steps = useMemo(() => {
    const s = new Set<number>();
    for (const n of turn.timeline) if (n.step != null) s.add(n.step);
    return Array.from(s).sort((a, b) => a - b);
  }, [turn]);

  // `cursor` indexes into `steps`; null means "show the full final graph".
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // Reset replay whenever the inspected turn changes.
  useEffect(() => {
    setCursor(null);
    setPlaying(false);
  }, [turn.id]);

  // Advance one superstep every 700ms while playing; stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (cursor != null && cursor >= steps.length - 1) {
      const done = setTimeout(() => {
        setPlaying(false);
        setCursor(null); // settle on the full final graph
      }, 700);
      return () => clearTimeout(done);
    }
    const id = setTimeout(() => setCursor((c) => (c == null ? 0 : c + 1)), 700);
    return () => clearTimeout(id);
  }, [playing, cursor, steps.length]);

  const hasTrace = steps.length > 0;
  const currentStep = cursor == null ? null : steps[cursor];
  const shown: TurnExecution =
    currentStep == null ? turn : { ...turn, nodes: nodesAtStep(turn, currentStep) };

  const play = () => {
    setCursor(0);
    setPlaying(true);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <button
          onClick={playing ? () => setPlaying(false) : play}
          disabled={!hasTrace}
          className="rounded-md border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-surface-3 disabled:opacity-40"
        >
          {playing ? "⏸ Pause" : "▶ Replay"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor(null);
          }}
          disabled={!hasTrace || cursor == null}
          className="rounded-md border border-hairline bg-surface-2 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-surface-3 disabled:opacity-40"
        >
          Show full
        </button>
        <span className="ml-auto tnum text-[10px] text-slate-500">
          {hasTrace
            ? currentStep == null
              ? `${steps.length} supersteps`
              : `superstep ${currentStep} (${(cursor ?? 0) + 1}/${steps.length})`
            : "no trace captured"}
        </span>
      </div>
      <GraphView topology={topology} run={shown} />
    </div>
  );
}
