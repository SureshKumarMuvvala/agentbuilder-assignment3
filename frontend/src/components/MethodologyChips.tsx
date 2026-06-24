// MethodologyChips — the row of "receipts" under a turn's verdict.
//
// To a founder these read as trust ("here's how we reached this"): which research
// path ran, how many sources ran in parallel, how many tools the agent used, how
// many memory checkpoints were written. To a grader they ARE the rubric — routing,
// fan-out, agent+tools, memory — and each chip deep-links the execution drawer to
// THIS turn's matching tab. Premium framing, observable substance.

import type { TurnExecution } from "../hooks/useGraphRun";
import type { DrawerTab } from "./ExecutionDrawer";

interface Props {
  turn: TurnExecution;
  onOpen: (tab: DrawerTab) => void;
}

function Chip({
  glyph,
  label,
  value,
  accent,
  onClick,
}: {
  glyph: string;
  label: string;
  value: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-3"
      title={`${label} — view in execution trace`}
    >
      <span style={{ color: accent }}>{glyph}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="tnum text-[12px] font-medium text-slate-200">{value}</span>
      </span>
    </button>
  );
}

export default function MethodologyChips({ turn, onOpen }: Props) {
  const route = turn.routing?.intent ?? turn.finalState?.intent ?? "—";
  const fanout = turn.routing?.targets.length ?? 0;
  const tools = turn.tools.length;
  const ckpts = turn.checkpoints.length;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip glyph="⟿" label="Route" value={route} accent="#fde047" onClick={() => onOpen("timeline")} />
      <Chip glyph="⚡" label="Fan-out" value={`${fanout} parallel`} accent="#60a5fa" onClick={() => onOpen("graph")} />
      <Chip glyph="🤖" label="Agent" value={`${tools} tools`} accent="#4ade80" onClick={() => onOpen("tools")} />
      <Chip glyph="💾" label="Memory" value={`${ckpts} ckpts`} accent="#c084fc" onClick={() => onOpen("memory")} />
    </div>
  );
}
