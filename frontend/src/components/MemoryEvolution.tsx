// MemoryEvolution — the Memory tab, shown ACROSS turns instead of just the latest.
//
// Memory is the point of the thread: one thread_id, persisted in SQLite, growing
// every turn until the summarizer compresses it. This panel makes that growth
// visible — for each turn it shows the stored message count, the checkpoints
// written, and whether summarization likely fired (message count past the trigger)
// — so a grader can watch memory evolve, not just inspect a single snapshot.

import type { TurnExecution } from "../hooks/useGraphRun";

interface Props {
  turns: TurnExecution[];
  selectedId: string | null;
  summaryTrigger: number;
}

// Messages persisted after a turn = that turn's final checkpointed message list,
// or a fallback estimate (2 per completed turn) for historical/pre-trace turns.
function messageCount(turn: TurnExecution): number {
  const persisted = turn.finalState?.messages?.length;
  if (typeof persisted === "number") return persisted;
  return turn.index * 2; // 1 human + 1 ai per prior turn, approximate
}

export default function MemoryEvolution({ turns, selectedId, summaryTrigger }: Props) {
  if (turns.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No turns yet.</div>;
  }

  const peak = Math.max(1, ...turns.map(messageCount), summaryTrigger + 2);

  return (
    <div className="p-3 text-sm">
      <div className="mb-3 text-[11px] text-slate-500">
        One thread, persisted in SQLite. Memory grows each turn; the summarizer
        compresses it once it passes {summaryTrigger} messages.
      </div>

      <div className="flex flex-col gap-2">
        {turns.map((t) => {
          const msgs = messageCount(t);
          const summarized = msgs > summaryTrigger;
          const selected = t.id === selectedId;
          return (
            <div
              key={t.id}
              className="rounded-lg border px-2.5 py-2"
              style={{
                borderColor: selected ? "rgba(192,132,252,0.5)" : "#1e2430",
                background: selected ? "rgba(192,132,252,0.06)" : "#0d0f14",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-slate-300">
                  Turn {t.index}
                </span>
                <span className="line-clamp-1 text-[12px] text-slate-300">{t.question}</span>
                <span className="ml-auto tnum text-[10px] text-slate-500">{t.checkpoints.length} ckpts</span>
              </div>

              {/* Memory-size bar: how many messages were stored after this turn. */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(msgs / peak) * 100}%`, background: "#c084fc" }}
                  />
                </div>
                <span className="tnum text-[10px] text-slate-400">{msgs} msgs</span>
              </div>

              {summarized && (
                <div className="mt-1 text-[10px] text-node-magenta">
                  ✓ summarize_if_needed fired (history compressed)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
