// ReportCanvas — the centre of the app and its hero: the verdict-first report.
//
// It renders the thread's turns. The SELECTED turn (latest by default) is the full
// ResultCard; the other turns stack below as compact history cards, newest-first.
// Selecting a historical turn restores its full analysis here in the centre, while
// the execution drawer restores its trace — each turn is a complete artifact.

import { useState } from "react";
import type { TurnExecution } from "../hooks/useGraphRun";
import { normalizeIntent, parseVerdict, verdictTheme } from "../lib/ui";
import { asResearch, hasAnySignal } from "../lib/research";
import ResultCard from "./ResultCard";
import RoutingBadge from "./RoutingBadge";
import InsightColumns from "./InsightColumns";
import logoUrl from "../assets/launchlens-logo.png";
import type { DrawerTab } from "./ExecutionDrawer";

interface Props {
  turns: TurnExecution[];
  selectedId: string | null;
  running: boolean;
  onSend: (question: string) => void;
  onSelectTurn: (turnId: string) => void;
  onOpenExecution: (turnId: string, tab?: DrawerTab) => void;
}

function Composer({
  running,
  onSend,
  centered,
}: {
  running: boolean;
  onSend: (q: string) => void;
  centered?: boolean;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    const q = text.trim();
    if (!q || running) return;
    onSend(q);
    setText("");
  };
  return (
    <div className={`flex gap-2 ${centered ? "" : "border-t border-hairline bg-surface-1/60 p-3"}`}>
      <input
        className="flex-1 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-slate-600"
        placeholder={centered ? "e.g. insulated steel water bottle" : "Ask a follow-up… “what about the US market?”"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={running}
      />
      <button
        className="rounded-xl bg-verdict-go px-5 py-3 text-sm font-semibold text-surface-0 transition-opacity disabled:opacity-40"
        onClick={submit}
        disabled={running}
      >
        {centered ? "Analyze" : "Send"}
      </button>
    </div>
  );
}

// A compact history card for the turns that aren't currently in the hero. Clicking
// it RESTORES that turn as the centre analysis (and the drawer follows). The badge
// is intent-aware: full reports show their GO/NICHE/NO-GO verdict, other intents
// show their routing label — and we never show a "PENDING" pill.
function HistoryCard({
  turn,
  onSelect,
  onView,
}: {
  turn: TurnExecution;
  onSelect: () => void;
  onView: () => void;
}) {
  const intent = normalizeIntent(turn.routing?.intent ?? turn.finalState?.intent);
  const verdict = parseVerdict(turn.answer);
  const theme = verdictTheme(verdict);
  const showVerdict = intent === "full" && verdict !== "PENDING";
  return (
    <article
      onClick={onSelect}
      className="cursor-pointer rounded-xl border border-hairline bg-surface-1 p-4 transition-colors hover:bg-surface-2"
      title="Restore this turn's analysis"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14px] font-medium text-slate-300">
          <span className="mr-1.5 text-slate-600">Turn {turn.index}</span>
          {turn.question}
        </h3>
        {turn.answer &&
          (showVerdict ? (
            <span
              className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide"
              style={{ color: theme.color, background: theme.bg, border: `1px solid ${theme.ring}` }}
            >
              {theme.label}
            </span>
          ) : (
            <RoutingBadge intent={intent} />
          ))}
      </div>
      {turn.answer && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-500">{turn.answer}</p>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
        className="mt-2 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200"
        title="Inspect this turn's Timeline · State · Graph · Tools · Memory"
      >
        View execution ›
      </button>
    </article>
  );
}

export default function ReportCanvas({
  turns,
  selectedId,
  running,
  onSend,
  onSelectTurn,
  onOpenExecution,
}: Props) {
  // Empty state: a focused, intent-setting landing — not an idle debugger.
  if (turns.length === 0) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-0 px-6">
        <div className="w-full max-w-xl text-center">
          <img
            src={logoUrl}
            alt="LaunchLens"
            className="mx-auto mb-7 h-16 w-auto object-contain"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">Will it sell?</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-400">
            Type a product idea. LaunchLens pulls demand and supply signals and returns a
            GO / NICHE / NO-GO with the receipts.
          </p>
          <div className="mt-6">
            <Composer running={running} onSend={onSend} centered />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-600">
            {["Trends", "Shopping", "News", "Amazon", "Reviews"].map((s) => (
              <span key={s} className="rounded-full border border-hairline px-2.5 py-1">
                ⌁ {s}
              </span>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // The hero is the SELECTED turn (latest by default); the rest stack below,
  // newest-first. Selecting a historical turn swaps the hero to it.
  const latest = turns[turns.length - 1];
  const hero = turns.find((t) => t.id === selectedId) ?? latest;
  const isHistorical = hero.id !== latest.id;
  const history = turns.filter((t) => t.id !== hero.id).reverse();

  const research = hero.finalState?.research ?? null;
  // Demand/Supply columns add value on the full report; the focused intent cards
  // already surface their own (demand/pricing/reviews) signals.
  const heroIntent = normalizeIntent(hero.routing?.intent ?? hero.finalState?.intent);
  const showInsights =
    hero.answer && heroIntent === "full" && hasAnySignal(asResearch(research));

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-surface-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {isHistorical && (
            <div className="flex items-center justify-between rounded-lg border border-node-blue/30 bg-node-blue/10 px-3 py-1.5 text-[12px]">
              <span className="text-slate-300">
                Viewing <span className="font-semibold">Turn {hero.index}</span> (historical)
              </span>
              <button
                onClick={() => onSelectTurn(latest.id)}
                className="font-medium text-node-blue transition-opacity hover:opacity-80"
              >
                Back to latest (Turn {latest.index}) ›
              </button>
            </div>
          )}
          <ResultCard turn={hero} onOpenExecution={onOpenExecution} />
          {showInsights && <InsightColumns research={research} />}
          {history.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-600">
                {isHistorical ? "Other turns" : "Earlier in this analysis"}
              </div>
              {history.map((t) => (
                <HistoryCard
                  key={t.id}
                  turn={t}
                  onSelect={() => onSelectTurn(t.id)}
                  onView={() => onOpenExecution(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <Composer running={running} onSend={onSend} />
    </main>
  );
}
