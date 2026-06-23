// ExecutionInspector — the node-by-node timeline of one run.
//
// Each node that executed gets a row: its concept badge, live status, duration,
// the superstep number (nodes sharing a step ran in parallel), and an expandable
// view of the exact state delta it returned. This is the "what happened, in what
// order, and how long did it take" panel.

import { useState } from "react";
import type { NodeRun } from "../hooks/useGraphRun";
import { colorHex, pretty } from "../lib/ui";

function StatusDot({ status }: { status: NodeRun["status"] }) {
  const map = { idle: "#475569", running: "#fde047", done: "#4ade80", error: "#f87171" };
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{
        background: map[status],
        animation: status === "running" ? "pulse 1s infinite" : undefined,
      }}
    />
  );
}

function Row({ node }: { node: NodeRun }) {
  const [open, setOpen] = useState(false);
  const hasDelta = node.delta && Object.keys(node.delta).length > 0;
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <StatusDot status={node.status} />
        <span className="text-sm font-medium" style={{ color: colorHex(node.color) }}>
          {node.label}
        </span>
        {node.step != null && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            step {node.step}
          </span>
        )}
        <span className="text-[10px] text-slate-500">{node.concept}</span>
        <span className="ml-auto text-[11px] text-slate-400">
          {node.durationMs != null ? `${node.durationMs} ms` : node.status === "running" ? "running…" : ""}
        </span>
        {hasDelta && <span className="text-slate-600">{open ? "▾" : "▸"}</span>}
      </button>
      {open && hasDelta && (
        <pre className="overflow-x-auto border-t border-slate-800 bg-black/40 px-3 py-2 text-[11px] text-slate-300">
          {pretty(node.delta)}
        </pre>
      )}
      {node.error && (
        <div className="border-t border-slate-800 px-3 py-1 text-[11px] text-red-400">
          {node.error}
        </div>
      )}
    </div>
  );
}

export default function ExecutionInspector({ timeline }: { timeline: NodeRun[] }) {
  if (timeline.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Run a query to see the node timeline (start → memory → router → fan-out → agent).
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 p-3">
      {timeline.map((node) => (
        <Row key={node.node} node={node} />
      ))}
    </div>
  );
}
