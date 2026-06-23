// StateViewer — the live LaunchLensState: routing decision, merged research dict,
// and a count of stored messages (the typed-state + memory concepts, made visible).
//
// It prefers the final merged state once a run finishes; during a run it shows the
// routing decision and the research keys as they stream in.

import type { GraphState } from "../types";
import type { RunState } from "../hooks/useGraphRun";
import { pretty } from "../lib/ui";

interface Props {
  run: RunState;
  persisted: GraphState | null; // checkpointed state fetched on thread load
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{title}</div>
      {children}
    </div>
  );
}

export default function StateViewer({ run, persisted }: Props) {
  const state = run.finalState ?? persisted;

  // Research either from the final state, or assembled live from streamed deltas.
  const liveResearch = state?.research ?? {};

  return (
    <div className="p-3 text-sm">
      <Section title="intent (routing)">
        {run.routing ? (
          <div>
            <span className="rounded bg-yellow-400/15 px-2 py-0.5 font-semibold text-yellow-300">
              {run.routing.intent}
            </span>
            <span className="ml-2 text-[11px] text-slate-400">
              → {run.routing.targets.length} branch
              {run.routing.targets.length === 1 ? "" : "es"}
            </span>
          </div>
        ) : (
          <span className="text-slate-500">{state?.intent || "—"}</span>
        )}
      </Section>

      {run.routing?.keyword && (
        <Section title="search keyword (extracted from question)">
          <code className="rounded bg-black/40 px-2 py-0.5 text-[12px] text-cyan-300">
            {run.routing.keyword}
          </code>
        </Section>
      )}

      <Section title="research (merged via operator.or_)">
        {Object.keys(liveResearch).length > 0 ? (
          <pre className="overflow-x-auto rounded bg-black/40 px-2 py-1.5 text-[11px] text-slate-300">
            {pretty(liveResearch)}
          </pre>
        ) : (
          <span className="text-slate-500">no research yet</span>
        )}
      </Section>

      <Section title="messages (checkpointed memory)">
        <div className="text-[12px] text-slate-300">
          {state?.messages?.length ?? 0} message(s) stored in SQLite for this thread
        </div>
      </Section>
    </div>
  );
}
