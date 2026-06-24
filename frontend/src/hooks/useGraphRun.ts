// useGraphRun — owns the execution history for the active thread.
//
// THE FIX: previously this held a single RunState that was wiped on every query,
// so each new turn destroyed the last turn's Timeline/State/Graph/Tools/Memory.
// Now it keeps an append-only list of TurnExecution records — one per user query —
// and never overwrites a prior turn. Live SSE events patch only the latest turn;
// older turns stay fully inspectable (LangSmith-style, one trace per turn).

import { useCallback, useState } from "react";
import { streamChat } from "../api/client";
import type { ChatMessage, GraphState, StreamEvent } from "../types";
import { buildTurnResult } from "../lib/turnResult";
import type { TurnResult } from "../lib/turnResult";

export type NodeStatus = "idle" | "running" | "done" | "error";

export interface NodeRun {
  node: string;
  label: string;
  concept: string;
  color: string;
  status: NodeStatus;
  step: number | null;
  durationMs: number | null;
  delta?: Record<string, unknown>;
  error?: string | null;
}

export interface ToolRun {
  tool: string;
  node: string;
  input: string;
  output?: unknown;
  status: "running" | "done" | "error";
}

export interface CheckpointEntry {
  step: number;
  next: string[];
}

// One query's complete execution trace. Captured live, then frozen as history.
export interface TurnExecution {
  id: string;
  index: number; // 1-based turn number within the thread
  question: string;
  answer?: string; // the verdict text
  status: "running" | "done" | "error";
  // Per-node status keyed by node id (drives the graph colouring).
  nodes: Record<string, NodeRun>;
  // Ordered execution timeline (a node appears once, updated in place).
  timeline: NodeRun[];
  tools: ToolRun[];
  checkpoints: CheckpointEntry[];
  routing: { intent: string; keyword: string; targets: string[] } | null;
  finalState: GraphState | null;
  error: string | null;
  // The complete research artifact (business output + execution trace),
  // materialized once the turn finishes so it's preserved, not re-derived.
  result?: TurnResult;
}

interface HookState {
  turns: TurnExecution[];
  running: boolean;
}

const EMPTY: HookState = { turns: [], running: false };

function makeTurn(id: string, index: number, question: string): TurnExecution {
  return {
    id,
    index,
    question,
    status: "running",
    nodes: {},
    timeline: [],
    tools: [],
    checkpoints: [],
    routing: null,
    finalState: null,
    error: null,
  };
}

// Browser-safe unique id for a live turn (historical turns use a stable index id).
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `live-${Math.round(performance.now())}`;
}

export function useGraphRun() {
  const [state, setState] = useState<HookState>(EMPTY);

  // Every setState updater below stays PURE (derives only from `prev`) so React
  // StrictMode's double-invoke is idempotent. We only ever PATCH the latest turn,
  // never the historical ones — that's what preserves execution history.
  const handleEvent = useCallback((ev: StreamEvent) => {
    setState((prev) => {
      // Replace the most recent turn via `fn`, leaving earlier turns untouched.
      const patchLast = (fn: (t: TurnExecution) => TurnExecution): HookState => {
        if (prev.turns.length === 0) return prev;
        const turns = prev.turns.slice();
        turns[turns.length - 1] = fn(turns[turns.length - 1]);
        return { ...prev, turns };
      };

      switch (ev.type) {
        case "node_start":
          return patchLast((t) => {
            const run: NodeRun = {
              node: ev.node,
              label: ev.label,
              concept: ev.concept,
              color: ev.color,
              status: "running",
              step: ev.step,
              durationMs: null,
            };
            const timeline = t.timeline.some((n) => n.node === ev.node)
              ? t.timeline.map((n) => (n.node === ev.node ? run : n))
              : [...t.timeline, run];
            return { ...t, nodes: { ...t.nodes, [ev.node]: run }, timeline };
          });

        case "node_end":
          return patchLast((t) => {
            const existing = t.nodes[ev.node];
            const run: NodeRun = {
              ...(existing ?? {
                node: ev.node,
                label: ev.node,
                concept: "",
                color: "white",
                step: null,
              }),
              status: ev.error ? "error" : "done",
              durationMs: ev.duration_ms,
              delta: ev.delta,
              error: ev.error,
            };
            return {
              ...t,
              nodes: { ...t.nodes, [ev.node]: run },
              timeline: t.timeline.map((n) => (n.node === ev.node ? run : n)),
            };
          });

        case "tool_start":
          return patchLast((t) => ({
            ...t,
            tools: [...t.tools, { tool: ev.tool, node: ev.node, input: ev.input, status: "running" }],
          }));

        case "tool_end":
          return patchLast((t) => ({
            ...t,
            tools: t.tools.map((tool) =>
              tool.tool === ev.tool && tool.status === "running"
                ? { ...tool, output: ev.output, status: ev.error ? "error" : "done" }
                : tool,
            ),
          }));

        case "routing":
          return patchLast((t) => ({
            ...t,
            routing: { intent: ev.intent, keyword: ev.keyword, targets: ev.targets },
          }));

        case "checkpoint":
          return patchLast((t) => ({
            ...t,
            checkpoints: [...t.checkpoints, { step: ev.step, next: ev.next }],
          }));

        case "final":
          // Assign (not append) — idempotent under StrictMode's double-invoke.
          return patchLast((t) => ({ ...t, finalState: ev.state, answer: ev.verdict }));

        case "error":
          return patchLast((t) => ({ ...t, error: ev.message, status: "error" }));

        default:
          return prev;
      }
    });
  }, []);

  const run = useCallback(
    async (question: string, threadId: string) => {
      // Append a fresh turn (id generated outside the updater to keep it pure).
      const id = newId();
      setState((prev) => ({
        running: true,
        turns: [...prev.turns, makeTurn(id, prev.turns.length + 1, question)],
      }));

      try {
        await streamChat(question, threadId, handleEvent);
      } catch (e) {
        setState((prev) => {
          if (prev.turns.length === 0) return prev;
          const turns = prev.turns.slice();
          const last = turns[turns.length - 1];
          turns[turns.length - 1] = { ...last, error: String(e), status: "error" };
          return { ...prev, turns };
        });
      } finally {
        // Mark the latest turn done (unless it errored), clear the running flag,
        // and MATERIALIZE its complete TurnResult so the artifact is preserved.
        setState((prev) => ({
          ...prev,
          running: false,
          turns: prev.turns.map((t, i) => {
            if (i !== prev.turns.length - 1) return t;
            const done = t.status === "error" ? t : { ...t, status: "done" as const };
            return { ...done, result: buildTurnResult(done) };
          }),
        }));
      }
    },
    [handleEvent],
  );

  // Rebuild the thread's turns from its checkpointed transcript when switching
  // threads. These historical turns carry the Q&A but no live trace (traces are
  // only captured during a live run this session), so their inspector panels show
  // "no trace captured" gracefully.
  const reset = useCallback((messages: ChatMessage[] = []) => {
    const turns: TurnExecution[] = [];
    let idx = 0;
    for (const m of messages) {
      if (m.role === "human") {
        idx += 1;
        turns.push({ ...makeTurn(`hist-${idx}`, idx, m.content), status: "done" });
      } else if (m.role === "ai" && turns.length) {
        turns[turns.length - 1].answer = m.content;
      }
    }
    // Materialize each historical turn's artifact (business output from its prose;
    // execution trace is empty since those runs happened before this session).
    const withResults = turns.map((t) => ({ ...t, result: buildTurnResult(t) }));
    setState({ turns: withResults, running: false });
  }, []);

  const currentTurn = state.turns.length ? state.turns[state.turns.length - 1] : null;

  return { turns: state.turns, running: state.running, currentTurn, run, reset };
}
