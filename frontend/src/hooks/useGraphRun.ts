// useGraphRun — the single source of truth for "what is the graph doing right now".
//
// It owns one chat turn's worth of live state: which nodes are idle/running/done,
// the tool calls and their results, routing decision, checkpoint (memory) activity,
// the running node timeline, and the final verdict. Components read slices of this;
// the SSE handler below is the only thing that writes it.

import { useCallback, useState } from "react";
import { streamChat } from "../api/client";
import type { ChatMessage, GraphState, StreamEvent } from "../types";

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

export interface RunState {
  running: boolean;
  // Per-node status keyed by node id (drives the graph colouring).
  nodes: Record<string, NodeRun>;
  // Ordered execution timeline (a node appears once, updated in place).
  timeline: NodeRun[];
  tools: ToolRun[];
  checkpoints: CheckpointEntry[];
  routing: { intent: string; keyword: string; targets: string[] } | null;
  finalState: GraphState | null;
  transcript: ChatMessage[];
  error: string | null;
}

const EMPTY: RunState = {
  running: false,
  nodes: {},
  timeline: [],
  tools: [],
  checkpoints: [],
  routing: null,
  finalState: null,
  transcript: [],
  error: null,
};

export function useGraphRun() {
  const [state, setState] = useState<RunState>(EMPTY);

  // NOTE: every setState updater below must be PURE (derive only from `prev`).
  // React StrictMode double-invokes updaters in dev to catch impurities, so any
  // side effect here (e.g. mutating a ref) would run twice — which previously
  // duplicated the verdict in the transcript. The transcript lives in state and
  // is carried across runs via `prev.transcript`, no ref needed.
  const handleEvent = useCallback((ev: StreamEvent) => {
    setState((prev) => {
      switch (ev.type) {
        case "node_start": {
          const run: NodeRun = {
            node: ev.node,
            label: ev.label,
            concept: ev.concept,
            color: ev.color,
            status: "running",
            step: ev.step,
            durationMs: null,
          };
          const timeline = prev.timeline.some((n) => n.node === ev.node)
            ? prev.timeline.map((n) => (n.node === ev.node ? run : n))
            : [...prev.timeline, run];
          return { ...prev, nodes: { ...prev.nodes, [ev.node]: run }, timeline };
        }
        case "node_end": {
          const existing = prev.nodes[ev.node];
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
            ...prev,
            nodes: { ...prev.nodes, [ev.node]: run },
            timeline: prev.timeline.map((n) => (n.node === ev.node ? run : n)),
          };
        }
        case "tool_start":
          return {
            ...prev,
            tools: [
              ...prev.tools,
              { tool: ev.tool, node: ev.node, input: ev.input, status: "running" },
            ],
          };
        case "tool_end":
          return {
            ...prev,
            tools: prev.tools.map((t) =>
              t.tool === ev.tool && t.status === "running"
                ? { ...t, output: ev.output, status: ev.error ? "error" : "done" }
                : t,
            ),
          };
        case "routing":
          return {
            ...prev,
            routing: { intent: ev.intent, keyword: ev.keyword, targets: ev.targets },
          };
        case "checkpoint":
          return {
            ...prev,
            checkpoints: [...prev.checkpoints, { step: ev.step, next: ev.next }],
          };
        case "final": {
          // Append the verdict to the transcript — purely, from prev.
          const ai: ChatMessage = { role: "ai", content: ev.verdict };
          return {
            ...prev,
            finalState: ev.state,
            transcript: [...prev.transcript, ai],
          };
        }
        case "error":
          return { ...prev, error: ev.message };
        default:
          return prev;
      }
    });
  }, []);

  const run = useCallback(
    async (question: string, threadId: string) => {
      // Record the human turn and reset the live (per-run) panels, keeping the
      // existing transcript. Functional update = pure, so StrictMode's double
      // invoke is idempotent (computes [...prev.transcript, human] either way).
      const human: ChatMessage = { role: "human", content: question };
      setState((prev) => ({
        ...EMPTY,
        running: true,
        transcript: [...prev.transcript, human],
      }));

      try {
        await streamChat(question, threadId, handleEvent);
      } catch (e) {
        setState((prev) => ({ ...prev, error: String(e) }));
      } finally {
        setState((prev) => ({ ...prev, running: false }));
      }
    },
    [handleEvent],
  );

  // Reset everything when switching to a fresh conversation.
  const reset = useCallback((transcript: ChatMessage[] = []) => {
    setState({ ...EMPTY, transcript });
  }, []);

  return { state, run, reset };
}
