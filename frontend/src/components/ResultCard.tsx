// ResultCard — the report hero, rendered PER ROUTED INTENT.
//
// The router classifies each question as demand / pricing / reviews / full, and
// gathers only the matching signals. So a single "verdict" card is wrong for three
// of the four paths — it would show "Pending" because those paths never produce a
// GO/NO-GO/NICHE. Instead we branch on the intent and render the right card:
//
//   demand  → Demand Analysis  (trend score, direction, related searches)
//   pricing → Pricing Analysis (market prices, recommended pricing)
//   reviews → Review Analysis  (common complaints, opportunity gaps)
//   full    → Verdict          (GO/NO-GO/NICHE + demand/supply/competition/confidence)
//
// A RoutingBadge announces the path so the router behaviour is obvious to graders.

import type { TurnExecution } from "../hooks/useGraphRun";
import { verdictTheme, type Intent, type Scores, type VerdictLabel } from "../lib/ui";
import { asResearch, fmtPrice, ok, priceBand, type Research } from "../lib/research";
import { buildTurnResult } from "../lib/turnResult";
import MethodologyChips from "./MethodologyChips";
import RoutingBadge from "./RoutingBadge";
import type { DrawerTab } from "./ExecutionDrawer";

interface Props {
  turn: TurnExecution;
  onOpenExecution: (turnId: string, tab?: DrawerTab) => void;
}

// --- shared bits --------------------------------------------------------------

function CardHeader({
  turn,
  intent,
  onView,
}: {
  turn: TurnExecution;
  intent: Intent;
  onView: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Turn {turn.index}</span>
          <RoutingBadge intent={intent} />
        </div>
        <button
          onClick={onView}
          className="rounded-lg border border-hairline bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-surface-3"
          title="Inspect this turn's Timeline · State · Graph · Tools · Memory"
        >
          View execution ›
        </button>
      </div>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-100">{turn.question}</h2>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="tnum mt-1 text-[18px] font-semibold" style={{ color: accent ?? "#e2e8f0" }}>
        {value}
      </div>
    </div>
  );
}

function ScoreBadge({ label, value, accent }: { label: string; value: number | null; accent: string }) {
  const pct = value ?? 0;
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-[20px] font-bold" style={{ color: value == null ? "#64748b" : accent }}>
          {value == null ? "—" : value}
        </span>
        {value != null && <span className="text-[11px] text-slate-500">/100</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent, opacity: value == null ? 0.2 : 1 }} />
      </div>
    </div>
  );
}

const TREND_META: Record<string, { glyph: string; word: string; color: string }> = {
  rising: { glyph: "▲", word: "Rising", color: "#34d399" },
  falling: { glyph: "▼", word: "Falling", color: "#fb7185" },
  flat: { glyph: "▬", word: "Flat", color: "#94a3b8" },
};

function Chips({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="text-[12px] text-slate-500">none</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, 6).map((q, i) => (
        <span key={i} className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] text-slate-300">
          {q}
        </span>
      ))}
    </div>
  );
}

// --- per-intent bodies --------------------------------------------------------

function DemandBody({ r }: { r: Research }) {
  const t = r.trends;
  const tm = ok(t) && t.trend ? TREND_META[t.trend] : null;
  return (
    <section>
      <div className="text-[13px] font-semibold text-slate-200">Demand Analysis</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          label="Trend score"
          value={ok(t) && typeof t.avg_interest === "number" ? `${t.avg_interest}/100` : "—"}
          accent="#60a5fa"
        />
        <Stat label="Trend direction" value={tm ? `${tm.glyph} ${tm.word}` : "—"} accent={tm?.color} />
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Related searches</div>
        <div className="mt-1.5">
          <Chips items={ok(t) ? t.related : undefined} />
        </div>
      </div>
    </section>
  );
}

function PricingBody({ r }: { r: Research }) {
  const s = r.shopping;
  const a = r.amazon;
  const src = ok(s) ? s : ok(a) ? a : undefined;
  const median = ok(s) && typeof s.median === "number" ? s.median : undefined;
  // Recommended entry: just under the market median (undercut), else the band low.
  const recommended =
    median != null
      ? `${fmtPrice(Math.round(median * 0.9))}–${fmtPrice(median)}`
      : src && typeof src.low === "number"
        ? `~${fmtPrice(src.low)}`
        : "—";
  return (
    <section>
      <div className="text-[13px] font-semibold text-slate-200">Pricing Analysis</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Market prices" value={src ? priceBand(src.low, src.high) : "—"} accent="#22d3ee" />
        <Stat label="Recommended pricing" value={recommended} accent="#34d399" />
      </div>
      {median != null && (
        <div className="mt-2 text-[11px] text-slate-500">
          Market median {fmtPrice(median)} — enter just below it to undercut incumbents.
        </div>
      )}
    </section>
  );
}

function ReviewsBody({ r }: { r: Research }) {
  const rv = r.reviews;
  const complaints = ok(rv) && Array.isArray(rv.complaints) ? rv.complaints : [];
  return (
    <section>
      <div className="text-[13px] font-semibold text-slate-200">Review Analysis</div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Common complaints</div>
          {complaints.length ? (
            <ul className="mt-1.5 space-y-1">
              {complaints.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] text-slate-300">
                  <span className="text-verdict-nogo">✗</span>
                  <span className="line-clamp-1">“{c}”</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1.5 text-[12px] text-slate-500">No recurring complaints found.</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Opportunity gaps</div>
          {complaints.length ? (
            <ul className="mt-1.5 space-y-1">
              {complaints.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] text-slate-300">
                  <span className="text-verdict-go">→</span>
                  <span className="line-clamp-1">Build one that fixes “{c}”</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1.5 text-[12px] text-slate-500">No clear gaps surfaced.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function FullBody({ verdict, scores }: { verdict: VerdictLabel; scores: Scores }) {
  const theme = verdictTheme(verdict);
  return (
    <section>
      {verdict !== "PENDING" && (
        <div
          className="inline-flex rounded-xl px-4 py-2.5 text-3xl font-extrabold tracking-tight"
          style={{ color: theme.color, background: theme.bg, border: `1px solid ${theme.ring}` }}
        >
          {theme.label}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScoreBadge label="Demand" value={scores.demand} accent="#60a5fa" />
        <ScoreBadge label="Supply" value={scores.supply} accent="#22d3ee" />
        <ScoreBadge label="Competition" value={scores.competition} accent="#fbbf24" />
        <ScoreBadge label="Confidence" value={scores.confidence} accent={theme.color} />
      </div>
    </section>
  );
}

// The concrete, intent-specific next steps — an explicit, preserved part of the
// research artifact (TurnResult.recommendations), not just buried in the prose.
function Recommendations({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">Recommendations</div>
      <ul className="mt-1.5 space-y-1">
        {items.map((rec, i) => (
          <li key={i} className="flex gap-1.5 text-[13px] text-slate-300">
            <span className="text-verdict-go">→</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- dispatcher ---------------------------------------------------------------

export default function ResultCard({ turn, onOpenExecution }: Props) {
  // Render from the complete, preserved artifact (materialized on completion;
  // rebuilt on the fly if we're mid-run). This is what restores a historical
  // turn's full analysis when it's reselected.
  const result = turn.result ?? buildTurnResult(turn);
  const { intent, verdict, scores, recommendations, analysis, rationale } = result;
  const r = asResearch(turn.finalState?.research ?? null);
  const running = turn.status === "running";

  return (
    <article className="animate-verdict-in rounded-2xl border border-hairline bg-surface-2 p-6 shadow-card">
      <CardHeader turn={turn} intent={intent} onView={() => onOpenExecution(turn.id)} />

      {!turn.answer ? (
        <div className="mt-5 flex items-center gap-2 text-[14px] text-slate-400">
          <span className="h-2.5 w-2.5 rounded-full bg-verdict-go" style={{ animation: "pulse 1s infinite" }} />
          {running ? "Researching…" : "Awaiting analysis."}
        </div>
      ) : (
        <>
          <div className="mt-5">
            {intent === "demand" && <DemandBody r={r} />}
            {intent === "pricing" && <PricingBody r={r} />}
            {intent === "reviews" && <ReviewsBody r={r} />}
            {intent === "full" && <FullBody verdict={verdict} scores={scores} />}
          </div>

          {analysis && <p className="mt-4 text-[14px] leading-relaxed text-slate-200">{analysis}</p>}

          <Recommendations items={recommendations} />

          <div className="mt-4">
            <MethodologyChips turn={turn} onOpen={(tab) => onOpenExecution(turn.id, tab)} />
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Rationale</div>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-300">{rationale}</p>
          </div>
        </>
      )}
    </article>
  );
}
