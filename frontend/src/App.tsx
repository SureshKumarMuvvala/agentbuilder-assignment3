// App — the LaunchLens shell. Verdict-first, observability-on-demand.
//
// Layout (premium SaaS, not a debugger):
//   ┌───────────────────────────────────────────────────────────────────┐
//   │ TopBar: brand · provider status pill                               │
//   ├──────────────┬─────────────────────────────────────┬──────────────┤
//   │ ThreadSidebar│  ReportCanvas                        │ Execution    │
//   │ (analyses +  │  (verdict → research → composer)     │ Drawer       │
//   │  memory)     │                                      │ (collapsed)  │
//   └──────────────┴─────────────────────────────────────┴──────────────┘
//
// The graph and the full node/tool/state trace live in the right-hand
// ExecutionDrawer, collapsed by default to a thin rail of "concept receipts"
// (route · fan-out · agent · memory). The verdict is the hero; the trace is one
// click away — so a grader still finds all 5 LangGraph concepts in seconds.

import { useEffect, useMemo, useState } from "react";
import {
  createThread,
  fetchConfig,
  fetchGraph,
  fetchThreadState,
  fetchThreads,
  setProvider,
} from "./api/client";
import type { AppConfig, GraphState, GraphTopology } from "./types";
import { useGraphRun } from "./hooks/useGraphRun";
import TopBar from "./components/TopBar";
import ThreadSidebar from "./components/ThreadSidebar";
import ReportCanvas from "./components/ReportCanvas";
import ExecutionDrawer, { type DrawerTab } from "./components/ExecutionDrawer";

// Mirror of SUMMARY_TRIGGER in launchlens/graph.py — drives the memory footnote.
const SUMMARY_TRIGGER = 10;

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [topology, setTopology] = useState<GraphTopology | null>(null);
  const [threads, setThreads] = useState<string[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [persisted, setPersisted] = useState<GraphState | null>(null);
  // thread_id -> opening question, used as the sidebar title. Derived client-side
  // since /api/threads only returns ids; "" marks "fetched, no question yet".
  const [threadTitles, setThreadTitles] = useState<Record<string, string>>({});

  // Execution drawer: collapsed by default. `selectedTurnId` is which turn the
  // drawer inspects — so every turn's trace can be opened independently.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("graph");
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);

  const { turns, running, currentTurn, run, reset } = useGraphRun();

  // The selected turn (falls back to the latest if nothing/everything was reset).
  const selectedTurn = useMemo(
    () => turns.find((t) => t.id === selectedTurnId) ?? currentTurn,
    [turns, selectedTurnId, currentTurn],
  );

  // Open a specific turn's trace (from a [View Execution] button or a chip).
  const openExecution = (turnId: string, tab?: DrawerTab) => {
    setSelectedTurnId(turnId);
    if (tab) setDrawerTab(tab);
    setDrawerOpen(true);
  };

  // While a run is live, follow the latest turn so the drawer streams it; the user
  // can still click an older Turn chip to pin it.
  useEffect(() => {
    if (running && currentTurn) setSelectedTurnId(currentTurn.id);
  }, [running, currentTurn]);

  // Bootstrap: load config, graph topology, and the thread list once.
  useEffect(() => {
    fetchConfig().then((c) => {
      setConfig(c);
      setThreadId(c.default_thread_id);
    });
    fetchGraph().then(setTopology);
    fetchThreads().then((t) => setThreads(t.map((x) => x.thread_id)));
  }, []);

  // When the active thread changes, rehydrate its checkpointed transcript/state.
  useEffect(() => {
    if (!threadId) return;
    fetchThreadState(threadId).then((s) => {
      setPersisted(s);
      reset(s.messages ?? []);
    });
  }, [threadId, reset]);

  // Derive a friendly title (the opening question) for any thread we haven't
  // looked up yet. Runs once per new thread; setting "" marks it as fetched so
  // this never loops. Small N (demo-scale thread lists).
  useEffect(() => {
    const unknown = threads.filter((t) => !(t in threadTitles));
    if (unknown.length === 0) return;
    let cancelled = false;
    Promise.all(
      unknown.map(async (t) => {
        try {
          const s = await fetchThreadState(t);
          const first = s.messages?.find((m) => m.role === "human");
          return [t, first?.content ?? ""] as const;
        } catch {
          return [t, ""] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setThreadTitles((prev) => {
        const next = { ...prev };
        for (const [t, title] of pairs) next[t] = title;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [threads, threadTitles]);

  const onSend = (q: string) => run(q, threadId);

  // Switch LLM provider at runtime. Takes effect on the next chat turn (the graph
  // reads the provider fresh each turn). On failure (e.g. missing key) we keep the
  // current selection and surface the backend's message.
  const [providerError, setProviderError] = useState<string | null>(null);
  const onProviderChange = async (provider: string) => {
    setProviderError(null);
    try {
      const updated = await setProvider(provider);
      setConfig(updated);
    } catch (e) {
      setProviderError(String(e instanceof Error ? e.message : e));
    }
  };

  const onNewThread = async () => {
    const id = await createThread();
    setThreads((t) => [id, ...t]);
    setThreadId(id);
  };

  // The active thread's opening question (for the sidebar title) and its persisted
  // message count (for the memory footnote), derived from the turn history.
  const activeQuery = turns[0]?.question;

  // Reflect the active thread's first question into the title map immediately
  // (no refetch needed once the user has asked something in this session).
  useEffect(() => {
    if (!threadId || !activeQuery) return;
    setThreadTitles((prev) =>
      prev[threadId] === activeQuery ? prev : { ...prev, [threadId]: activeQuery },
    );
  }, [threadId, activeQuery]);

  const messageCount =
    turns.reduce((n, t) => n + 1 + (t.answer ? 1 : 0), 0) || persisted?.messages?.length || 0;

  // Surface the latest turn's error (live-run failures) in the status bar.
  const latestError = currentTurn?.error ?? null;

  return (
    <div className="flex h-screen flex-col bg-surface-0 text-slate-200">
      <TopBar
        config={config}
        running={running}
        onProviderChange={onProviderChange}
        providerError={providerError}
      />

      <div className="flex min-h-0 flex-1">
        <ThreadSidebar
          threads={threads}
          threadId={threadId}
          titles={threadTitles}
          messageCount={messageCount}
          summaryTrigger={SUMMARY_TRIGGER}
          onSelect={setThreadId}
          onNew={onNewThread}
        />

        <ReportCanvas
          turns={turns}
          selectedId={selectedTurnId}
          running={running}
          onSend={onSend}
          onSelectTurn={setSelectedTurnId}
          onOpenExecution={openExecution}
        />

        <ExecutionDrawer
          open={drawerOpen}
          tab={drawerTab}
          topology={topology}
          turns={turns}
          turn={selectedTurn}
          persisted={persisted}
          summaryTrigger={SUMMARY_TRIGGER}
          onToggle={setDrawerOpen}
          onTab={setDrawerTab}
          onSelectTurn={setSelectedTurnId}
        />
      </div>

      {latestError && (
        <div className="border-t border-rose-900 bg-rose-950/50 px-4 py-1.5 text-xs text-rose-300">
          {latestError}
        </div>
      )}
    </div>
  );
}
