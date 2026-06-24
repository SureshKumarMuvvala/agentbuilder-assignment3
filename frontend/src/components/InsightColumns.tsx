// InsightColumns — the "research insights" tier: the demand side (SerpApi) and
// the supply side (Oxylabs) shown side by side, so the fusion the agent performs
// is legible to a human too.
//
// Every sub-component reads one slim dict from the research dict and renders it as
// real UI (a trend chip, a price-band bar, a headline list, a complaints list) —
// no raw JSON. The raw dicts still live in the execution drawer for graders.

import { asResearch, fmtPrice, ok, type Research } from "../lib/research";

// --- Small presentational parts ----------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="text-right text-[12px] text-slate-200">{children}</div>
    </div>
  );
}

const TREND_META: Record<string, { glyph: string; word: string; color: string }> = {
  rising: { glyph: "▲", word: "rising", color: "#34d399" },
  falling: { glyph: "▼", word: "falling", color: "#fb7185" },
  flat: { glyph: "▬", word: "flat", color: "#94a3b8" },
};

function TrendChip({ trend, avg }: { trend?: string; avg?: number }) {
  const m = trend ? TREND_META[trend] : null;
  if (!m) return <span className="text-slate-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: m.color }}>
      <span>{m.glyph}</span>
      <span className="font-medium">{m.word}</span>
      {typeof avg === "number" && <span className="tnum text-slate-400">· {avg}/100</span>}
    </span>
  );
}

// A low→high price band with a marker at the median (when known).
function PriceBandBar({ low, high, median }: { low?: number; high?: number; median?: number }) {
  if (typeof low !== "number" || typeof high !== "number") {
    return <span className="text-slate-500">—</span>;
  }
  const span = Math.max(1, high - low);
  const pos = typeof median === "number" ? ((median - low) / span) * 100 : 50;
  return (
    <div className="w-40">
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-verdict-go/40 via-node-blue/40 to-verdict-nogo/40">
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-surface-0 bg-slate-100"
          style={{ left: `calc(${Math.min(100, Math.max(0, pos))}% - 5px)` }}
        />
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{fmtPrice(low)}</span>
        <span>{fmtPrice(high)}</span>
      </div>
    </div>
  );
}

function HeadlineList({ items }: { items?: string[] }) {
  if (!items?.length) return <div className="text-[12px] text-slate-500">No recent headlines.</div>;
  return (
    <ul className="space-y-1">
      {items.map((h, i) => (
        <li key={i} className="flex gap-1.5 text-[12px] text-slate-300">
          <span className="text-slate-600">•</span>
          <span className="line-clamp-1">{h}</span>
        </li>
      ))}
    </ul>
  );
}

function ComplaintList({ items }: { items?: string[] }) {
  if (!items?.length) return <div className="text-[12px] text-slate-500">No recurring complaints.</div>;
  return (
    <ul className="space-y-1">
      {items.map((c, i) => (
        <li key={i} className="flex gap-1.5 text-[12px] text-slate-300">
          <span className="text-verdict-nogo">✗</span>
          <span className="line-clamp-1">“{c}”</span>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  source,
  accent,
  children,
}: {
  title: string;
  source: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-2 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <h3 className="text-[12px] font-semibold text-slate-200">{title}</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-600">{source}</span>
      </div>
      {children}
    </section>
  );
}

// --- The two columns ----------------------------------------------------------

function DemandPanel({ r }: { r: Research }) {
  const t = r.trends;
  const n = r.news;
  const s = r.shopping;
  return (
    <Panel title="Demand" source="SerpApi" accent="#60a5fa">
      <div className="divide-y divide-hairline">
        <Row label="Google Trends">
          <TrendChip trend={ok(t) ? t.trend : undefined} avg={ok(t) ? t.avg_interest : undefined} />
        </Row>
        {ok(t) && t.related?.length ? (
          <Row label="Rising terms">
            <div className="flex flex-wrap justify-end gap-1">
              {t.related.slice(0, 3).map((q, i) => (
                <span key={i} className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {q}
                </span>
              ))}
            </div>
          </Row>
        ) : null}
        <Row label={`News${ok(n) && typeof n.count === "number" ? ` · ${n.count}` : ""}`}>
          <HeadlineList items={ok(n) ? n.recent_headlines : undefined} />
        </Row>
        <Row label={`Shopping${ok(s) && typeof s.n === "number" ? ` · ${s.n}` : ""}`}>
          <PriceBandBar
            low={ok(s) ? s.low : undefined}
            high={ok(s) ? s.high : undefined}
            median={ok(s) ? s.median : undefined}
          />
        </Row>
      </div>
    </Panel>
  );
}

function SupplyPanel({ r }: { r: Research }) {
  const a = r.amazon;
  const rv = r.reviews;
  return (
    <Panel title="Supply" source="Oxylabs" accent="#22d3ee">
      <div className="divide-y divide-hairline">
        <Row label="Amazon sellers">
          {ok(a) && typeof a.sellers === "number" ? (
            <span className="tnum">
              {a.sellers}
              {typeof a.avg_rating === "number" && <span className="text-slate-400"> · ★ {a.avg_rating}</span>}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Row>
        <Row label="Price band">
          <PriceBandBar low={ok(a) ? a.low : undefined} high={ok(a) ? a.high : undefined} />
        </Row>
        <Row label={`Gaps${ok(rv) && typeof rv.reviews_seen === "number" ? ` · ${rv.reviews_seen} reviews` : ""}`}>
          <ComplaintList items={ok(rv) ? rv.complaints : undefined} />
        </Row>
      </div>
    </Panel>
  );
}

export default function InsightColumns({ research }: { research: Record<string, unknown> | null }) {
  const r = asResearch(research);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <DemandPanel r={r} />
      <SupplyPanel r={r} />
    </div>
  );
}
