// ExecutionDrawer — the LangGraph observability, as a per-turn trace browser.
//
// COLLAPSED: a thin rail of the five graded concepts as live "receipt" chips for
//   the selected turn, plus a pulse while it runs. The 30-second grader path.
// EXPANDED: an Execution History strip (Turn 1..N) to pick ANY turn independently,
//   then that turn's full trace — Graph (replayable), Timeline, Tools, State — and
//   a Memory tab that shows memory EVOLUTION across all turns. Older turns are
//   never overwritten; each keeps its own trace.

import type { GraphState, GraphTopology } from "../types";
import type { TurnExecution } from "../hooks/useGraphRun";
import GraphReplay from "./GraphReplay";
import ExecutionInspector from "./ExecutionInspector";
import ToolTrace from "./ToolTrace";
import StateViewer from "./StateViewer";
import MemoryEvolution from "./MemoryEvolution";
import ConceptLegend from "./ConceptLegend";

export type DrawerTab = "graph" | "timeline" | "tools" | "state" | "memory";

interface Props {
  open: boolean;
  tab: DrawerTab;
  topology: GraphTopology | null;
  turns: TurnExecution[]; // full history
  turn: TurnExecution | null; // the selected turn
  persisted: GraphState | null;
  summaryTrigger: number;
  onToggle: (open: boolean) => void;
  onTab: (tab: DrawerTab) => void;
  onSelectTurn: (id: string) => void;
}

function RailChip({
  glyph,
  value,
  accent,
  title,
  onClick,
}: {
  glyph: string;
  value: string;
  accent: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="group flex w-full flex-col items-center gap-0.5 rounded-lg py-2 transition-colors hover:bg-surface-3"
    >
      <span className="text-[15px]" style={{ color: accent }}>
        {glyph}
      </span>
      <span className="tnum text-[10px] font-semibold text-slate-300">{value}</span>
    </button>
  );
}

const TABS: { id: DrawerTab; label: string }[] = [
  { id: "graph", label: "Graph" },
  { id: "timeline", label: "Timeline" },
  { id: "tools", label: "Tools" },
  { id: "state", label: "State" },
  { id: "memory", label: "Memory" },
];

export default function ExecutionDrawer({
  open,
  tab,
  topology,
  turns,
  turn,
  persisted,
  summaryTrigger,
  onToggle,
  onTab,
  onSelectTurn,
}: Props) {
  const running = turn?.status === "running";
  const route = turn?.routing?.intent ?? turn?.finalState?.intent ?? "—";
  const fanout = turn?.routing?.targets.length ?? 0;
  const toolCount = turn?.tools.length ?? 0;
  const ckpts = turn?.checkpoints.length ?? 0;

  const openTo = (t: DrawerTab) => {
    onTab(t);
    onToggle(true);
  };

  // ---- Collapsed: the thin concept rail -------------------------------------
  if (!open) {
    return (
      <aside className="flex w-[56px] shrink-0 flex-col items-center border-l border-hairline bg-surface-1 py-2">
        <button
          onClick={() => onToggle(true)}
          title="Open execution trace"
          className="mb-1 grid h-7 w-7 place-items-center rounded-md border border-hairline text-slate-400 hover:bg-surface-3"
        >
          ‹
        </button>

        <div className="mb-2 h-4">
          {running && (
            <span
              className="block h-2 w-2 rounded-full bg-verdict-go"
              style={{ animation: "pulse 1s infinite" }}
              title="running…"
            />
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-1 px-1">
          <RailChip glyph="⟿" value={route} accent="#fde047" title={`Routing: ${route}`} onClick={() => openTo("timeline")} />
          <RailChip glyph="⚡" value={`${fanout}×`} accent="#60a5fa" title="Fan-out (parallel)" onClick={() => openTo("graph")} />
          <RailChip glyph="🤖" value={`${toolCount}`} accent="#4ade80" title="Agent + tools" onClick={() => openTo("tools")} />
          <RailChip glyph="💾" value={`${ckpts}`} accent="#c084fc" title="Memory checkpoints" onClick={() => openTo("memory")} />
        </div>

        <div className="rotate-180 pb-1 text-[9px] uppercase tracking-widest text-slate-600 [writing-mode:vertical-rl]">
          execution
        </div>
      </aside>
    );
  }

  // ---- Expanded: the full per-turn trace ------------------------------------
  return (
    <aside className="flex w-[440px] shrink-0 flex-col border-l border-hairline bg-surface-1">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Execution trace
          </span>
          {turn && <span className="text-[11px] text-slate-500">· Turn {turn.index}</span>}
          {running && (
            <span className="h-2 w-2 rounded-full bg-verdict-go" style={{ animation: "pulse 1s infinite" }} />
          )}
        </div>
        <button
          onClick={() => onToggle(false)}
          title="Collapse"
          className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-surface-3"
        >
          ›
        </button>
      </div>

      {/* Execution History — pick any turn independently. */}
      <div className="border-b border-hairline px-3 py-2">
        <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">Execution history</div>
        {turns.length === 0 ? (
          <div className="text-[11px] text-slate-600">No turns yet.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {turns.map((t) => {
              const selected = t.id === turn?.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTurn(t.id)}
                  title={t.question}
                  className="rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    borderColor: selected ? "rgba(96,165,250,0.5)" : "#1e2430",
                    background: selected ? "rgba(96,165,250,0.12)" : "transparent",
                    color: selected ? "#bfdbfe" : "#94a3b8",
                  }}
                >
                  Turn {t.index}
                  {t.status === "running" && " …"}
                  {t.status === "error" && " ⚠"}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-hairline px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className="rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: tab === t.id ? "#1a1f29" : "transparent",
              color: tab === t.id ? "#e2e8f0" : "#64748b",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel body — per-turn, except Memory which spans all turns. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!turn ? (
          <div className="p-4 text-sm text-slate-500">Run a query to capture a trace.</div>
        ) : (
          <>
            {tab === "graph" && <GraphReplay turn={turn} topology={topology} />}
            {tab === "timeline" && <ExecutionInspector timeline={turn.timeline} />}
            {tab === "tools" && <ToolTrace tools={turn.tools} />}
            {tab === "state" && <StateViewer run={turn} persisted={persisted} />}
            {tab === "memory" && (
              <MemoryEvolution turns={turns} selectedId={turn.id} summaryTrigger={summaryTrigger} />
            )}
          </>
        )}
      </div>

      {/* Concept legend — rubric, evidence-backed for the selected turn. */}
      {turn && <ConceptLegend run={turn} topology={topology} />}
    </aside>
  );
}
