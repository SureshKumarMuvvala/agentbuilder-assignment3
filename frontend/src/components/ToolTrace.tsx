// ToolTrace — every tool call this run made, with its input and slim result.
//
// In LaunchLens the fan-out research nodes each call exactly one tool (Google
// Trends/Shopping/News on the demand side; Amazon search/reviews on the supply
// side). This panel shows the call, the query it ran, and the <200-byte dict it
// returned — making the "Agent + Tools / slim output" rules visible at a glance.

import type { ToolRun } from "../hooks/useGraphRun";
import { pretty } from "../lib/ui";

// Colour demand (SerpApi) vs supply (Oxylabs) tools so the fusion is legible.
const DEMAND = new Set(["google_trends", "google_shopping", "google_news"]);

function Badge({ tool }: { tool: string }) {
  const demand = DEMAND.has(tool);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: demand ? "rgba(96,165,250,0.15)" : "rgba(34,211,238,0.15)",
        color: demand ? "#60a5fa" : "#22d3ee",
      }}
    >
      {demand ? "demand · SerpApi" : "supply · Oxylabs"}
    </span>
  );
}

export default function ToolTrace({ tools }: { tools: ToolRun[] }) {
  if (tools.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No tool calls yet.</div>;
  }
  return (
    <div className="flex flex-col gap-2 p-3">
      {tools.map((t, i) => (
        <div key={i} className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
          <div className="flex items-center gap-2">
            <code className="text-[12px] text-slate-200">{t.tool}()</code>
            <Badge tool={t.tool} />
            <span className="ml-auto text-[10px] text-slate-500">
              {t.status === "running" ? "running…" : t.status === "error" ? "error" : "done"}
            </span>
          </div>
          {t.input && (
            <div className="mt-1 text-[11px] text-slate-400">
              input: <span className="text-slate-300">{t.input}</span>
            </div>
          )}
          {t.output !== undefined && (
            <pre className="mt-1 overflow-x-auto rounded bg-black/40 px-2 py-1 text-[11px] text-slate-300">
              {pretty(t.output)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
