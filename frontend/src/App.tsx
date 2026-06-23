// App — the LaunchLens execution viewer.
//
// Layout (LangSmith-style, observability first):
//   ┌───────────────────────────────────────────────────────────────┐
//   │ header: title · LLM-mode badge · thread switcher                │
//   ├──────────────┬───────────────────────────┬────────────────────┤
//   │  Graph view  │  Execution inspector       │  Chat              │
//   │  (topology + │  Tool trace                │  (transcript +     │
//   │   live status)│  State viewer / Memory    │   input)           │
//   └──────────────┴───────────────────────────┴────────────────────┘
//
// The three middle tabs (Inspector / Tools / State / Memory) and the always-on
// graph make the 5 graded concepts identifiable at a glance.

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
import GraphView from "./components/GraphView";
import ExecutionInspector from "./components/ExecutionInspector";
import ToolTrace from "./components/ToolTrace";
import StateViewer from "./components/StateViewer";
import Chat from "./components/Chat";

type Tab = "inspector" | "tools" | "state" | "memory";

function Panel({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
        {right}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [topology, setTopology] = useState<GraphTopology | null>(null);
  const [threads, setThreads] = useState<string[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [persisted, setPersisted] = useState<GraphState | null>(null);
  const [tab, setTab] = useState<Tab>("inspector");

  const { state, run, reset } = useGraphRun();

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

  const onSend = (q: string) => run(q, threadId);

  // Switch LLM provider at runtime. Takes effect on the next chat turn (the graph
  // reads the provider fresh each turn). On failure (e.g. missing key) we keep
  // the current selection and surface the backend's message.
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

  const supersteps = useMemo(() => {
    const steps = new Set(state.timeline.map((n) => n.step).filter((s) => s != null));
    return steps.size;
  }, [state.timeline]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-2.5">
        <span className="text-lg font-bold text-cyan-300">LaunchLens</span>
        <span className="text-xs text-slate-500">LangGraph execution viewer</span>
        {config && (
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: config.mock ? "#fde047" : "#4ade80" }}
              title={config.mock ? "mock mode (fixtures, no keys)" : "live mode"}
            />
            <label className="text-[11px] text-slate-500">LLM</label>
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold disabled:opacity-50"
              value={config.provider}
              disabled={state.running}
              onChange={(e) => onProviderChange(e.target.value)}
              title={state.running ? "Can't switch mid-run" : "Switch LLM provider"}
            >
              {config.providers.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.available}>
                  {p.name}
                  {p.available ? "" : " (no key)"}
                </option>
              ))}
            </select>
          </div>
        )}
        {providerError && (
          <span className="text-[11px] text-red-400">{providerError}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-slate-500">thread</label>
          <select
            className="max-w-[200px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
          >
            {threads.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onNewThread}
          >
            + new
          </button>
        </div>
      </header>

      {/* Body: three columns */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,1.1fr)_minmax(360px,1.3fr)_minmax(320px,1fr)] gap-3 p-3">
        {/* Graph */}
        <Panel
          title="Graph"
          right={
            state.running ? (
              <span className="text-[10px] text-yellow-400">running…</span>
            ) : supersteps > 0 ? (
              <span className="text-[10px] text-slate-500">{supersteps} supersteps</span>
            ) : null
          }
        >
          <GraphView topology={topology} run={state} />
        </Panel>

        {/* Inspector / Tools / State / Memory tabs */}
        <Panel
          title="Inspector"
          right={
            <div className="flex gap-1">
              {(["inspector", "tools", "state", "memory"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className="rounded px-2 py-0.5 text-[11px] capitalize"
                  style={{
                    background: tab === t ? "#1e293b" : "transparent",
                    color: tab === t ? "#e2e8f0" : "#64748b",
                  }}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        >
          {tab === "inspector" && <ExecutionInspector timeline={state.timeline} />}
          {tab === "tools" && <ToolTrace tools={state.tools} />}
          {tab === "state" && <StateViewer run={state} persisted={persisted} />}
          {tab === "memory" && (
            <div className="p-3 text-sm">
              <div className="mb-2 text-[11px] text-slate-500">
                SqliteSaver checkpoints written this run (state persisted after each superstep):
              </div>
              {state.checkpoints.length === 0 ? (
                <div className="text-slate-500">No checkpoints yet.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {state.checkpoints.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1 text-[11px]"
                    >
                      <span
                        className="rounded px-1.5"
                        style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}
                      >
                        step {c.step}
                      </span>
                      <span className="text-slate-400">
                        next: {c.next.length ? c.next.join(", ") : "— (end)"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Chat */}
        <Panel title="Chat">
          <Chat transcript={state.transcript} running={state.running} onSend={onSend} />
        </Panel>
      </div>

      {state.error && (
        <div className="border-t border-red-900 bg-red-950/50 px-4 py-1.5 text-xs text-red-300">
          {state.error}
        </div>
      )}
    </div>
  );
}
