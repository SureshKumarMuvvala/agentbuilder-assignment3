// ThreadSidebar — the left rail: past analyses + a "new analysis" button.
//
// This is where MEMORY stops being a dev affordance (the old thread <select>) and
// becomes a product value: each thread is a remembered analysis, and the footnote
// surfaces that this conversation persists in SQLite and auto-summarizes once it
// grows past the trigger. Per-thread titles-from-query land in Stage 3; for now
// the active thread shows its opening question.

interface Props {
  threads: string[];
  threadId: string;
  titles: Record<string, string>; // thread_id -> opening question (derived)
  messageCount: number; // messages persisted for the active thread
  summaryTrigger: number; // SUMMARY_TRIGGER from the backend graph
  onSelect: (id: string) => void;
  onNew: () => void;
}

// A thread id is long; show a stable short tail so rows stay scannable.
function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-6)}` : id;
}

export default function ThreadSidebar({
  threads,
  threadId,
  titles,
  messageCount,
  summaryTrigger,
  onSelect,
  onNew,
}: Props) {
  const summarized = messageCount > summaryTrigger;

  return (
    <aside className="flex min-h-0 w-[232px] shrink-0 flex-col border-r border-hairline bg-surface-1">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Analyses
        </span>
        <button
          className="grid h-6 w-6 place-items-center rounded-md border border-hairline text-slate-300 transition-colors hover:bg-surface-3"
          onClick={onNew}
          title="New analysis"
        >
          {/* SVG plus centres geometrically — a text "+" sits off-centre because
              of its baseline metrics. */}
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 2.5v7M2.5 6h7" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
        {threads.map((t) => {
          const active = t === threadId;
          const title = titles[t]?.trim();
          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              style={{
                background: active ? "#1a1f29" : "transparent",
              }}
            >
              <span
                className="line-clamp-1 text-[13px]"
                style={{ color: active ? "#e2e8f0" : "#94a3b8" }}
              >
                {title || "New analysis"}
              </span>
              <span className="text-[10px] text-slate-600">{shortId(t)}</span>
            </button>
          );
        })}
        {threads.length === 0 && (
          <div className="px-2.5 py-2 text-[12px] text-slate-600">No analyses yet.</div>
        )}
      </div>

      {/* Memory footnote — the persistent-memory concept, made legible. */}
      <div className="border-t border-hairline px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-slate-600">memory</div>
        <div className="mt-1 text-[11px] text-slate-400">
          <span className="tnum text-slate-200">{messageCount}</span> messages kept in SQLite
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          {summarized ? (
            <span className="text-node-magenta">summarized at {summaryTrigger} ✓</span>
          ) : (
            <span>summarizes at {summaryTrigger}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
